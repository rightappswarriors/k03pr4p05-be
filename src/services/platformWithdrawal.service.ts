import { randomUUID } from 'node:crypto';

import { encryptPayoutDestination } from '../lib/payoutDestinationCrypto.js';
import { getProductionPayoutProvider } from './productionPayoutProvider.service.js';
import { getOrCreatePlatformWallet } from './platformWallet.service.js';

type Environment = 'SANDBOX' | 'PRODUCTION';
type Actor = { id: number; orgId: number };

const money = (value: number) => Math.round(value * 100) / 100;
const reservationReference = (id: string) => `platform-withdrawal:${id}`;
const failureReference = (id: string) => `platform-withdrawal-failure:${id}`;

function requireAmount(amount: number) {
  const normalized = money(amount);
  if (!Number.isFinite(normalized) || normalized <= 0 || Math.abs(normalized - amount) > 0.0001) {
    throw new Error('Withdrawal amount must be a positive PHP amount with at most two decimal places.');
  }
  return normalized;
}

function sandboxSelfApprovalAllowed(environment: Environment) {
  return environment === 'SANDBOX' && process.env.NODE_ENV !== 'production' && process.env.SANDBOX_SETTLEMENT_MODE === 'true';
}

function audit(tx: any, actor: Actor, withdrawal: any, action: string, oldStatus?: string) {
  return tx.auditLog.create({
    data: {
      orgId: actor.orgId,
      userId: actor.id,
      pageKey: 'platformFees',
      action: 'STATUS_CHANGE',
      recordType: 'PlatformWithdrawal',
      recordId: withdrawal.id,
      oldValue: oldStatus ? { status: oldStatus } : null,
      newValue: { action, status: withdrawal.status, environment: withdrawal.environment, amount: withdrawal.amount },
    },
  });
}

export async function createPlatformPayoutMethod(
  tx: any,
  input: { environment: Environment; type: string; accountName: string; destination: string; bankName?: string | null },
  actor: Actor,
) {
  const accountName = input.accountName.trim();
  const destination = input.destination.replace(/\s+/g, '').trim();
  if (!accountName || !destination) throw new Error('Account name and payout destination are required.');
  if (accountName.length > 120 || destination.length > 120 || (input.bankName?.length ?? 0) > 120) throw new Error('Payout method fields are too long.');
  const visible = destination.slice(-4);
  return tx.platformPayoutMethod.create({
    data: {
      id: randomUUID(),
      environment: input.environment,
      type: input.type,
      accountName,
      bankName: input.bankName?.trim() || null,
      maskedAccountNumber: `•••• ${visible}`,
      encryptedDestination: encryptPayoutDestination(destination),
      createdById: actor.id,
      isVerified: input.environment === 'SANDBOX' && process.env.NODE_ENV !== 'production',
      verifiedAt: input.environment === 'SANDBOX' && process.env.NODE_ENV !== 'production' ? new Date() : null,
      updatedAt: new Date(),
    },
  });
}

export async function verifyPlatformPayoutMethod(tx: any, id: string, actor: Actor) {
  const method = await tx.platformPayoutMethod.findFirst({ where: { id, deletedAt: null, isActive: true } });
  if (!method) throw new Error('Platform payout method not found.');
  if (method.createdById === actor.id && !sandboxSelfApprovalAllowed(method.environment)) {
    throw new Error('The administrator who created a production payout method cannot verify it.');
  }
  if (method.isVerified) return method;
  return tx.platformPayoutMethod.update({ where: { id }, data: { isVerified: true, verifiedAt: new Date(), updatedAt: new Date() } });
}

export async function requestPlatformWithdrawal(tx: any, environment: Environment, amountValue: number, payoutMethodId: string, actor: Actor) {
  const amount = requireAmount(amountValue);
  const wallet = await getOrCreatePlatformWallet(tx, environment);
  const payoutMethod = await tx.platformPayoutMethod.findFirst({ where: { id: payoutMethodId, environment, isActive: true, isVerified: true, deletedAt: null } });
  if (!payoutMethod) throw new Error('Select an active, verified platform payout method for this environment.');
  const withdrawalId = randomUUID();
  const reserved = await tx.platformWallet.updateMany({
    where: { id: wallet.id, environment, balance: { gte: amount } },
    data: { balance: { decrement: amount }, heldBalance: { increment: amount }, updatedAt: new Date() },
  });
  if (reserved.count !== 1) throw new Error('Platform wallet available balance is insufficient.');
  const updatedWallet = await tx.platformWallet.findUniqueOrThrow({ where: { id: wallet.id } });
  const withdrawal = await tx.platformWithdrawal.create({
    data: {
      id: withdrawalId,
      walletId: wallet.id,
      payoutMethodId: payoutMethod.id,
      amount,
      environment,
      requestedById: actor.id,
      payoutDestinationEncrypted: payoutMethod.encryptedDestination,
      payoutDestinationMasked: payoutMethod.maskedAccountNumber,
      payoutDestinationAccount: payoutMethod.accountName,
      payoutDestinationBank: payoutMethod.bankName,
      payoutMethodTypeSnapshot: payoutMethod.type,
    },
  });
  await tx.platformWalletLedgerEntry.create({
    data: {
      id: randomUUID(), walletId: wallet.id, type: 'DEBIT', sourceType: 'PLATFORM_WITHDRAWAL',
      referenceId: reservationReference(withdrawal.id), amount: -amount, balanceAfter: updatedWallet.balance,
      description: 'Platform withdrawal funds reserved.', environment,
    },
  });
  await audit(tx, actor, withdrawal, 'PLATFORM_WITHDRAWAL_REQUESTED');
  return withdrawal;
}

async function load(tx: any, id: string) {
  const withdrawal = await tx.platformWithdrawal.findFirst({ where: { id, deletedAt: null }, include: { wallet: true, payoutMethod: true, payoutAttempts: { orderBy: { createdAt: 'desc' } } } });
  if (!withdrawal) throw new Error('Platform withdrawal not found.');
  if (withdrawal.wallet.environment !== withdrawal.environment || withdrawal.payoutMethod.environment !== withdrawal.environment) throw new Error('Platform withdrawal environment is inconsistent.');
  return withdrawal;
}

async function restoreReservation(tx: any, withdrawal: any, referenceId: string, description: string) {
  const changed = await tx.platformWallet.updateMany({
    where: { id: withdrawal.walletId, heldBalance: { gte: withdrawal.amount } },
    data: { balance: { increment: withdrawal.amount }, heldBalance: { decrement: withdrawal.amount }, updatedAt: new Date() },
  });
  if (changed.count !== 1) throw new Error('Platform wallet held balance cannot cover the withdrawal.');
  const wallet = await tx.platformWallet.findUniqueOrThrow({ where: { id: withdrawal.walletId } });
  await tx.platformWalletLedgerEntry.create({
    data: { id: randomUUID(), walletId: wallet.id, type: 'CREDIT', sourceType: 'PLATFORM_WITHDRAWAL', referenceId, amount: withdrawal.amount, balanceAfter: wallet.balance, description, environment: withdrawal.environment },
  });
}

export async function approvePlatformWithdrawal(tx: any, id: string, actor: Actor) {
  const withdrawal = await load(tx, id);
  if (withdrawal.status !== 'PENDING') throw new Error('Platform withdrawal is no longer pending.');
  if (withdrawal.requestedById === actor.id && !sandboxSelfApprovalAllowed(withdrawal.environment)) {
    throw new Error('The requester cannot approve the same platform withdrawal.');
  }
  const changed = await tx.platformWithdrawal.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', approvedById: actor.id, approvedAt: new Date() } });
  if (changed.count !== 1) throw new Error('Platform withdrawal is no longer pending.');
  const updated = await tx.platformWithdrawal.findUniqueOrThrow({ where: { id } });
  await audit(tx, actor, updated, 'PLATFORM_WITHDRAWAL_APPROVED', 'PENDING');
  return updated;
}

export async function rejectPlatformWithdrawal(tx: any, id: string, reason: string, actor: Actor) {
  const withdrawal = await load(tx, id);
  if (withdrawal.status !== 'PENDING') throw new Error('Platform withdrawal is no longer pending.');
  const changed = await tx.platformWithdrawal.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', approvedById: actor.id, approvedAt: new Date(), rejectionReason: reason } });
  if (changed.count !== 1) throw new Error('Platform withdrawal is no longer pending.');
  await restoreReservation(tx, withdrawal, failureReference(id), 'Rejected platform withdrawal reservation restored.');
  const updated = await tx.platformWithdrawal.findUniqueOrThrow({ where: { id } });
  await audit(tx, actor, updated, 'PLATFORM_WITHDRAWAL_REJECTED', 'PENDING');
  return updated;
}

export async function startPlatformWithdrawalPayout(tx: any, id: string, actor: Actor) {
  const withdrawal = await load(tx, id);
  if (withdrawal.status !== 'APPROVED') throw new Error('Platform withdrawal must be approved before payout.');
  if (withdrawal.environment === 'PRODUCTION') getProductionPayoutProvider();
  const changed = await tx.platformWithdrawal.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'PROCESSING' } });
  if (changed.count !== 1) throw new Error('Platform withdrawal is no longer approved.');
  await tx.platformWithdrawalPayoutAttempt.create({
    data: { id: randomUUID(), withdrawalId: id, provider: withdrawal.environment === 'SANDBOX' ? 'SANDBOX_SIMULATOR' : 'UNCONFIGURED', environment: withdrawal.environment, amount: withdrawal.amount, status: 'PROCESSING', updatedAt: new Date() },
  });
  const updated = await tx.platformWithdrawal.findUniqueOrThrow({ where: { id } });
  await audit(tx, actor, updated, 'PLATFORM_PAYOUT_PROCESSING', 'APPROVED');
  return updated;
}

function requireSandbox(withdrawal: any) {
  if (!sandboxSelfApprovalAllowed(withdrawal.environment)) throw new Error('Sandbox payout simulation is disabled.');
}

export async function completeSandboxPlatformWithdrawal(tx: any, id: string, actor: Actor) {
  const withdrawal = await load(tx, id);
  requireSandbox(withdrawal);
  if (withdrawal.status === 'COMPLETED') return withdrawal;
  if (withdrawal.status !== 'PROCESSING') throw new Error('Platform withdrawal is not processing.');
  const changed = await tx.platformWithdrawal.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'COMPLETED', completedAt: new Date(), sandboxReference: `SBX-PLATFORM-${id}` } });
  if (changed.count !== 1) throw new Error('Platform withdrawal is already terminal.');
  const released = await tx.platformWallet.updateMany({ where: { id: withdrawal.walletId, heldBalance: { gte: withdrawal.amount } }, data: { heldBalance: { decrement: withdrawal.amount }, updatedAt: new Date() } });
  if (released.count !== 1) throw new Error('Platform wallet held balance cannot cover the withdrawal.');
  await tx.platformWithdrawalPayoutAttempt.updateMany({ where: { withdrawalId: id, status: 'PROCESSING' }, data: { status: 'SUCCEEDED', providerReference: `SBX-PLATFORM-${id}`, completedAt: new Date(), updatedAt: new Date() } });
  const updated = await tx.platformWithdrawal.findUniqueOrThrow({ where: { id } });
  await audit(tx, actor, updated, 'PLATFORM_PAYOUT_COMPLETED', 'PROCESSING');
  return updated;
}

export async function failSandboxPlatformWithdrawal(tx: any, id: string, reason: string, actor: Actor) {
  const withdrawal = await load(tx, id);
  requireSandbox(withdrawal);
  if (withdrawal.status === 'FAILED') return withdrawal;
  if (withdrawal.status !== 'PROCESSING') throw new Error('Platform withdrawal is not processing.');
  const changed = await tx.platformWithdrawal.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'FAILED', rejectionReason: reason } });
  if (changed.count !== 1) throw new Error('Platform withdrawal is already terminal.');
  await restoreReservation(tx, withdrawal, failureReference(id), 'Failed platform payout reservation restored.');
  await tx.platformWithdrawalPayoutAttempt.updateMany({ where: { withdrawalId: id, status: 'PROCESSING' }, data: { status: 'FAILED', failureReason: reason, completedAt: new Date(), updatedAt: new Date() } });
  const updated = await tx.platformWithdrawal.findUniqueOrThrow({ where: { id } });
  await audit(tx, actor, updated, 'PLATFORM_PAYOUT_FAILED', 'PROCESSING');
  return updated;
}
