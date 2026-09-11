import { PrismaClient } from '@prisma/client';
import { assertClose, reconcileWalletLedger } from './finance-ledger-invariants.js';

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const integerOption = (name: string) => {
  const value = Number(option(name));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
};

const walletId = integerOption('--wallet-id');
const withdrawalId = integerOption('--withdrawal-id');
const settlementId = option('--settlement-id');
if (!settlementId) throw new Error('--settlement-id is required.');
const apply = args.includes('--apply');
const allowProduction = args.includes('--allow-production');
if (apply && option('--confirm-reviewed-plan') !== 'DAY-18.5-FINANCE-INVARIANT') {
  throw new Error('Apply requires --confirm-reviewed-plan DAY-18.5-FINANCE-INVARIANT.');
}

async function inspect(client: any) {
  const wallet = await client.wallet.findUnique({
    where: { id: walletId },
    include: {
      ledgerEntries: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
      withdrawals: { where: { deletedAt: null }, include: { payoutAttempts: true }, orderBy: { id: 'asc' } },
    },
  });
  if (!wallet) throw new Error('Target wallet was not found.');
  if (wallet.environment !== 'SANDBOX' && !allowProduction) throw new Error('Only SANDBOX reconciliation is allowed without --allow-production.');

  const withdrawal = wallet.withdrawals.find((row: any) => row.id === withdrawalId);
  if (!withdrawal) throw new Error('Target withdrawal does not belong to the target wallet.');
  if (withdrawal.status !== 'COMPLETED') throw new Error('Target withdrawal is not an unambiguous completed withdrawal.');
  const reservation = wallet.ledgerEntries.filter((entry: any) => entry.sourceType === 'WITHDRAWAL' && entry.referenceId === `withdrawal:${withdrawal.id}`);
  const completion = wallet.ledgerEntries.filter((entry: any) => entry.sourceType === 'WITHDRAWAL' && entry.referenceId === `withdrawal-payout:${withdrawal.id}`);
  if (reservation.length !== 1 || completion.length !== 1) throw new Error('Target withdrawal must have exactly one reservation and one completion ledger row.');
  assertClose(Math.abs(reservation[0].amount), withdrawal.amount, 'withdrawal reservation amount');
  assertClose(Math.abs(completion[0].amount), withdrawal.amount, 'withdrawal completion amount');
  if (reservation[0].status !== 'RELEASED' || completion[0].status !== 'RELEASED') throw new Error('Target withdrawal does not match the canonical completed lifecycle.');

  const settlement = await client.purchaseOrderSettlement.findUnique({ where: { id: settlementId } });
  if (!settlement) throw new Error('Target settlement was not found.');
  if (settlement.supplierOrgId !== wallet.orgId || settlement.environment !== wallet.environment) throw new Error('Settlement does not belong to the target wallet scope.');
  if (!settlement.walletPostedAt || !settlement.walletLedgerEntryId) throw new Error('Settlement is not authoritatively posted.');

  const settlementCredit = wallet.ledgerEntries.filter((entry: any) => entry.id === settlement.walletLedgerEntryId && entry.sourceType === 'PURCHASE_ORDER_SETTLEMENT' && entry.referenceId === settlement.id);
  if (settlementCredit.length !== 1 || settlementCredit[0].status !== 'AVAILABLE') throw new Error('Settlement posting ledger is missing or ambiguous.');
  assertClose(settlementCredit[0].amount, settlement.supplierNet, 'settlement posting amount');

  const escrowHolds = wallet.ledgerEntries.filter((entry: any) => entry.sourceType === 'ESCROW_HOLD' && entry.referenceId === settlement.paymentTransactionId);
  if (escrowHolds.length !== 1) throw new Error('Settlement must have exactly one matching escrow hold.');
  const escrowHold = escrowHolds[0];
  assertClose(escrowHold.amount, settlement.supplierNet, 'settlement escrow amount');
  if (!['HELD', 'RELEASED'].includes(escrowHold.status)) throw new Error('Settlement escrow has an unsupported state; refusing repair.');

  const settlements = await client.purchaseOrderSettlement.findMany({ where: { supplierOrgId: wallet.orgId, environment: wallet.environment } });
  const state = reconcileWalletLedger(wallet.ledgerEntries, wallet.withdrawals, settlements);
  assertClose(state.available, wallet.balance, 'canonical available balance');
  assertClose(state.held, wallet.heldBalance, 'canonical held balance');
  const expectedDiagnostic = `POSTED_ESCROW_STILL_HELD:${escrowHold.id}`;
  const unrelatedDiagnostics = state.diagnostics.filter((value: string) => value !== expectedDiagnostic);
  if (unrelatedDiagnostics.length) throw new Error(`Unrelated ledger diagnostics prevent repair: ${unrelatedDiagnostics.join(', ')}`);
  if (escrowHold.status === 'HELD' && !state.diagnostics.includes(expectedDiagnostic)) throw new Error('Target escrow inconsistency was not proven.');

  return {
    before: {
      wallet: { id: wallet.id, orgId: wallet.orgId, environment: wallet.environment, balance: wallet.balance, heldBalance: wallet.heldBalance },
      canonical: state,
      withdrawal: { id: withdrawal.id, amount: withdrawal.amount, status: withdrawal.status, attemptCount: withdrawal.payoutAttempts.length, reservation: { id: reservation[0].id, status: reservation[0].status }, completion: { id: completion[0].id, status: completion[0].status } },
      settlement: { id: settlement.id, supplierNet: settlement.supplierNet, walletPostedAt: settlement.walletPostedAt, walletLedgerEntryId: settlement.walletLedgerEntryId, escrow: { id: escrowHold.id, status: escrowHold.status } },
    },
    escrowHold,
    proposedChange: escrowHold.status === 'HELD' ? { ledgerEntryId: escrowHold.id, status: { from: 'HELD', to: 'RELEASED' }, walletMutation: false } : null,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const plan = await inspect(prisma);
    console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', ...plan, note: 'No payout attempts or provider outcomes are created.' }, null, 2));
    if (!apply || !plan.proposedChange) return;

    await prisma.$transaction(async tx => {
      const checked = await inspect(tx);
      if (!checked.proposedChange) return;
      const updated = await tx.walletLedgerEntry.updateMany({
        where: { id: checked.escrowHold.id, walletId, sourceType: 'ESCROW_HOLD', referenceId: checked.escrowHold.referenceId, status: 'HELD', environment: checked.before.wallet.environment },
        data: { status: 'RELEASED' },
      });
      if (updated.count !== 1) throw new Error('Escrow state changed concurrently; no repair was applied.');
    }, { isolationLevel: 'Serializable' });
    const after = await inspect(prisma);
    console.log(JSON.stringify({ applied: true, after: after.before }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
