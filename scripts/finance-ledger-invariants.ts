export type LedgerEntryView = {
  id: number;
  sourceType: string;
  referenceId: string | null;
  amount: number;
  status: string;
};

export type WithdrawalView = {
  id: number;
  amount: number;
  status: string;
};

export type SettlementView = {
  id: string;
  paymentTransactionId: string;
  supplierNet: number;
  walletPostedAt: Date | null;
  walletLedgerEntryId: number | null;
};

export type WalletReconciliation = {
  available: number;
  held: number;
  diagnostics: string[];
};

const ACTIVE_WITHDRAWAL_STATUSES = new Set(['PENDING', 'APPROVED', 'PROCESSING']);
const close = (left: number, right: number) => Math.abs(left - right) < 0.005;

export function withdrawalReference(referenceId: string | null) {
  if (!referenceId) return null;
  let match = /^withdrawal:(\d+)$/.exec(referenceId);
  if (match) return { kind: 'RESERVATION' as const, withdrawalId: Number(match[1]) };
  match = /^withdrawal-payout:(\d+)$/.exec(referenceId);
  if (match) return { kind: 'COMPLETION' as const, withdrawalId: Number(match[1]) };
  match = /^withdrawal-(?:payout-failure|rejection):(\d+)$/.exec(referenceId);
  if (match) return { kind: 'RETURN' as const, withdrawalId: Number(match[1]) };
  return null;
}

/**
 * Wallet.balance is a materialized available-funds state. Withdrawal reservation
 * rows are its durable debit event even after HELD becomes RELEASED. Terminal
 * payout rows document held-fund disposal and must not debit available again.
 */
export function reconcileWalletLedger(
  entries: LedgerEntryView[],
  withdrawals: WithdrawalView[],
  settlements: SettlementView[],
): WalletReconciliation {
  const diagnostics: string[] = [];
  const withdrawalById = new Map(withdrawals.map(withdrawal => [withdrawal.id, withdrawal]));
  const postedPaymentIds = new Set(settlements
    .filter(settlement => settlement.walletPostedAt && settlement.walletLedgerEntryId)
    .map(settlement => settlement.paymentTransactionId));

  let available = 0;
  let held = 0;
  const seenReferences = new Set<string>();

  for (const entry of entries) {
    if (entry.referenceId) {
      const uniqueKey = `${entry.sourceType}:${entry.referenceId}`;
      if (seenReferences.has(uniqueKey)) diagnostics.push(`DUPLICATE_REFERENCE:${uniqueKey}`);
      seenReferences.add(uniqueKey);
    }

    if (entry.sourceType === 'WITHDRAWAL') {
      const reference = withdrawalReference(entry.referenceId);
      if (!reference) {
        diagnostics.push(`UNKNOWN_WITHDRAWAL_REFERENCE:${entry.id}`);
        continue;
      }
      const withdrawal = withdrawalById.get(reference.withdrawalId);
      if (!withdrawal || !close(Math.abs(entry.amount), withdrawal.amount)) {
        diagnostics.push(`WITHDRAWAL_AMOUNT_OR_ID_MISMATCH:${entry.id}`);
        continue;
      }
      if (reference.kind === 'RESERVATION') {
        available += entry.amount;
        const active = ACTIVE_WITHDRAWAL_STATUSES.has(withdrawal.status);
        if (active && entry.status !== 'HELD') diagnostics.push(`ACTIVE_WITHDRAWAL_NOT_HELD:${entry.id}`);
        if (!active && entry.status === 'HELD') diagnostics.push(`TERMINAL_WITHDRAWAL_STILL_HELD:${entry.id}`);
        if (active) held += Math.abs(entry.amount);
      } else if (reference.kind === 'RETURN') {
        available += entry.amount;
      }
      continue;
    }

    if (entry.sourceType === 'ESCROW_HOLD') {
      const logicallyReleased = Boolean(entry.referenceId && postedPaymentIds.has(entry.referenceId));
      if (logicallyReleased && entry.status === 'HELD') diagnostics.push(`POSTED_ESCROW_STILL_HELD:${entry.id}`);
      if (!logicallyReleased && entry.status === 'HELD') held += entry.amount;
      continue;
    }

    if (entry.status === 'AVAILABLE') available += entry.amount;
  }

  return { available, held, diagnostics };
}

export function assertClose(left: number, right: number, message: string) {
  if (!close(left, right)) throw new Error(`${message}: ${left} does not reconcile with ${right}`);
}
