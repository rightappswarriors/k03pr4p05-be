type PayoutActor = { id: number; orgId: number };

const reservationReference = (withdrawalId: number) => `withdrawal:${withdrawalId}`;
const completionReference = (withdrawalId: number) => `withdrawal-payout:${withdrawalId}`;
const failureReference = (withdrawalId: number) => `withdrawal-payout-failure:${withdrawalId}`;

/** Provider boundary: production has no adapter yet, so it never settles a payout. */
export interface PayoutProvider {
  processPayout(withdrawal: { id: number; environment: string }): Promise<'PROCESSING'>;
}

export const payoutProvider: PayoutProvider = {
  async processPayout() {
    return 'PROCESSING';
  },
};

const loadProcessableWithdrawal = async (tx: any, withdrawalId: number, expectedStatus: 'APPROVED' | 'PROCESSING') => {
  const withdrawal = await tx.withdrawal.findFirst({
    where: { id: withdrawalId, deletedAt: null },
    include: { wallet: true, payoutMethod: true },
  });
  if (!withdrawal) throw new Error('Withdrawal not found.');
  if (withdrawal.status !== expectedStatus) {
    if (expectedStatus === 'PROCESSING' && ['COMPLETED', 'FAILED'].includes(withdrawal.status)) return withdrawal;
    throw new Error(`Withdrawal must be ${expectedStatus} before this payout action.`);
  }
  if (withdrawal.wallet.deletedAt || withdrawal.wallet.environment !== withdrawal.environment) throw new Error('Withdrawal wallet environment does not match the request.');
  if (withdrawal.payoutMethod.deletedAt || !withdrawal.payoutMethod.isActive || !withdrawal.payoutMethod.isVerified) throw new Error('Withdrawal payout method is no longer active and verified.');
  if (withdrawal.payoutMethod.orgId !== withdrawal.wallet.orgId || withdrawal.payoutMethod.environment !== withdrawal.environment) throw new Error('Withdrawal payout method does not match its wallet environment.');
  const reservation = await tx.walletLedgerEntry.findFirst({
    where: { walletId: withdrawal.walletId, sourceType: 'WITHDRAWAL', referenceId: reservationReference(withdrawal.id), status: 'HELD', deletedAt: null },
  });
  if (!reservation || Math.abs(reservation.amount) !== withdrawal.amount) throw new Error('The withdrawal reservation is missing or does not match the withdrawal amount.');
  return withdrawal;
};

const audit = (tx: any, actor: PayoutActor, withdrawal: any, action: string, extra: Record<string, unknown> = {}) =>
  tx.auditLog.create({ data: { orgId: actor.orgId, userId: actor.id, pageKey: 'withdrawalReview', action: 'STATUS_CHANGE', recordType: 'Withdrawal', recordId: String(withdrawal.id), oldValue: { status: withdrawal.status }, newValue: { action, environment: withdrawal.environment, ...extra } } });

export async function startWithdrawalPayout(tx: any, withdrawalId: number, actor: PayoutActor) {
  const withdrawal = await loadProcessableWithdrawal(tx, withdrawalId, 'APPROVED');
  if (withdrawal.environment === 'PRODUCTION') {
    if (!withdrawal.payoutDestinationEncrypted || !withdrawal.payoutDestinationMasked || !withdrawal.payoutMethodTypeSnapshot) {
      throw new Error('Withdrawal is missing its immutable payout destination snapshot.');
    }
    // Do not transition or create an attempt until a real, independently
    // verifiable production disbursement adapter is configured.
    getProductionPayoutProvider();
  }
  await payoutProvider.processPayout(withdrawal);
  const transitioned = await tx.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'APPROVED', deletedAt: null }, data: { status: 'PROCESSING' } });
  if (transitioned.count !== 1) throw new Error('This withdrawal is no longer approved for payout.');
  const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } });
  await audit(tx, actor, withdrawal, 'PAYOUT_PROCESSING_STARTED', { status: 'PROCESSING' });
  return { withdrawal: updated, supplierOrgId: withdrawal.wallet.orgId, walletId: withdrawal.walletId };
}

const requireSandbox = (withdrawal: any) => {
  if (process.env.NODE_ENV === 'production' || process.env.SANDBOX_SETTLEMENT_MODE !== 'true' || withdrawal.environment !== 'SANDBOX') {
    throw new Error('Sandbox payout completion is unavailable in production and requires sandbox settlement mode.');
  }
};

export async function completeSandboxWithdrawalPayout(tx: any, withdrawalId: number, actor: PayoutActor) {
  const withdrawal = await loadProcessableWithdrawal(tx, withdrawalId, 'PROCESSING');
  requireSandbox(withdrawal);
  if (withdrawal.status === 'COMPLETED') return { withdrawal, supplierOrgId: withdrawal.wallet.orgId, walletId: withdrawal.walletId, alreadyTerminal: true };
  const transitioned = await tx.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'PROCESSING', deletedAt: null }, data: { status: 'COMPLETED', completedAt: new Date(), sandboxReference: withdrawal.sandboxReference ?? `SBX-PAYOUT-${String(withdrawal.id).padStart(6, '0')}` } });
  if (transitioned.count !== 1) throw new Error('This withdrawal has already reached a terminal payout state.');
  const changedWallet = await tx.wallet.updateMany({ where: { id: withdrawal.walletId, heldBalance: { gte: withdrawal.amount }, deletedAt: null }, data: { heldBalance: { decrement: withdrawal.amount } } });
  if (changedWallet.count !== 1) throw new Error('Wallet held balance cannot cover this withdrawal reservation.');
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: withdrawal.walletId } });
  await tx.walletLedgerEntry.updateMany({ where: { walletId: withdrawal.walletId, sourceType: 'WITHDRAWAL', referenceId: reservationReference(withdrawal.id), status: 'HELD' }, data: { status: 'RELEASED' } });
  await tx.walletLedgerEntry.create({ data: { walletId: withdrawal.walletId, type: 'DEBIT', sourceType: 'WITHDRAWAL', referenceId: completionReference(withdrawal.id), amount: -withdrawal.amount, balanceAfter: wallet.balance, status: 'RELEASED', environment: withdrawal.environment } });
  const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } });
  await audit(tx, actor, withdrawal, 'PAYOUT_COMPLETED', { status: 'COMPLETED', providerReference: updated.sandboxReference });
  return { withdrawal: updated, supplierOrgId: withdrawal.wallet.orgId, walletId: withdrawal.walletId };
}

export async function failSandboxWithdrawalPayout(tx: any, withdrawalId: number, reason: string, actor: PayoutActor) {
  const withdrawal = await loadProcessableWithdrawal(tx, withdrawalId, 'PROCESSING');
  requireSandbox(withdrawal);
  if (withdrawal.status === 'FAILED') return { withdrawal, supplierOrgId: withdrawal.wallet.orgId, walletId: withdrawal.walletId, alreadyTerminal: true };
  const transitioned = await tx.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'PROCESSING', deletedAt: null }, data: { status: 'FAILED', rejectionReason: reason } });
  if (transitioned.count !== 1) throw new Error('This withdrawal has already reached a terminal payout state.');
  const changedWallet = await tx.wallet.updateMany({ where: { id: withdrawal.walletId, heldBalance: { gte: withdrawal.amount }, deletedAt: null }, data: { balance: { increment: withdrawal.amount }, heldBalance: { decrement: withdrawal.amount } } });
  if (changedWallet.count !== 1) throw new Error('Wallet held balance cannot cover this withdrawal reservation.');
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: withdrawal.walletId } });
  await tx.walletLedgerEntry.updateMany({ where: { walletId: withdrawal.walletId, sourceType: 'WITHDRAWAL', referenceId: reservationReference(withdrawal.id), status: 'HELD' }, data: { status: 'RELEASED' } });
  await tx.walletLedgerEntry.create({ data: { walletId: withdrawal.walletId, type: 'CREDIT', sourceType: 'WITHDRAWAL', referenceId: failureReference(withdrawal.id), amount: withdrawal.amount, balanceAfter: wallet.balance, status: 'AVAILABLE', environment: withdrawal.environment } });
  const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } });
  await audit(tx, actor, withdrawal, 'PAYOUT_FAILED', { status: 'FAILED', reason });
  return { withdrawal: updated, supplierOrgId: withdrawal.wallet.orgId, walletId: withdrawal.walletId };
}
import { getProductionPayoutProvider } from './productionPayoutProvider.service.js';
