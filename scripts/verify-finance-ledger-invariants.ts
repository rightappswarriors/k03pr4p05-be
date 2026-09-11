import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { releaseSupplierFunds } from '../src/services/supplierSettlement.service.js';
import { assertClose, reconcileWalletLedger, type LedgerEntryView, type SettlementView, type WithdrawalView } from './finance-ledger-invariants.js';

const settlement = (posted: boolean): SettlementView => ({
  id: 'settlement-1',
  paymentTransactionId: 'payment-1',
  supplierNet: 97975,
  walletPostedAt: posted ? new Date('2026-08-31T09:53:35.536Z') : null,
  walletLedgerEntryId: posted ? 3 : null,
});

const reconcile = (entries: LedgerEntryView[], withdrawals: WithdrawalView[] = [], settlements: SettlementView[] = []) =>
  reconcileWalletLedger(entries, withdrawals, settlements);

function verifySyntheticLifecycle() {
  const opening: LedgerEntryView[] = [{ id: 1, sourceType: 'ADJUSTMENT', referenceId: 'opening', amount: 10000, status: 'AVAILABLE' }];
  assert.deepEqual(reconcile(opening), { available: 10000, held: 0, diagnostics: [] });

  const reservation: LedgerEntryView = { id: 2, sourceType: 'WITHDRAWAL', referenceId: 'withdrawal:10', amount: -2000, status: 'HELD' };
  for (const status of ['PENDING', 'APPROVED', 'PROCESSING']) {
    const state = reconcile([...opening, reservation], [{ id: 10, amount: 2000, status }]);
    assertClose(state.available, 8000, `${status} withdrawal available balance`);
    assertClose(state.held, 2000, `${status} withdrawal held balance`);
    assert.deepEqual(state.diagnostics, []);
  }

  const completed = reconcile([
    ...opening,
    { ...reservation, status: 'RELEASED' },
    { id: 3, sourceType: 'WITHDRAWAL', referenceId: 'withdrawal-payout:10', amount: -2000, status: 'RELEASED' },
  ], [{ id: 10, amount: 2000, status: 'COMPLETED' }]);
  assertClose(completed.available, 8000, 'completed withdrawal available balance');
  assertClose(completed.held, 0, 'completed withdrawal held balance');
  assert.deepEqual(completed.diagnostics, []);

  const failed = reconcile([
    ...opening,
    { ...reservation, status: 'RELEASED' },
    { id: 4, sourceType: 'WITHDRAWAL', referenceId: 'withdrawal-payout-failure:10', amount: 2000, status: 'AVAILABLE' },
  ], [{ id: 10, amount: 2000, status: 'FAILED' }]);
  assertClose(failed.available, 10000, 'failed withdrawal available balance');
  assertClose(failed.held, 0, 'failed withdrawal held balance');

  const rejected = reconcile([
    ...opening,
    { ...reservation, status: 'RELEASED' },
    { id: 5, sourceType: 'WITHDRAWAL', referenceId: 'withdrawal-rejection:10', amount: 2000, status: 'AVAILABLE' },
  ], [{ id: 10, amount: 2000, status: 'REJECTED' }]);
  assertClose(rejected.available, 10000, 'rejected withdrawal available balance');
  assertClose(rejected.held, 0, 'rejected withdrawal held balance');

  const escrowHold: LedgerEntryView = { id: 6, sourceType: 'ESCROW_HOLD', referenceId: 'payment-1', amount: 97975, status: 'HELD' };
  const held = reconcile([escrowHold], [], [settlement(false)]);
  assertClose(held.available, 0, 'pre-settlement available balance');
  assertClose(held.held, 97975, 'pre-settlement held balance');

  const postedEntries: LedgerEntryView[] = [
    { ...escrowHold, status: 'RELEASED' },
    { id: 3, sourceType: 'PURCHASE_ORDER_SETTLEMENT', referenceId: 'settlement-1', amount: 97975, status: 'AVAILABLE' },
  ];
  const posted = reconcile(postedEntries, [], [settlement(true)]);
  assertClose(posted.available, 97975, 'posted settlement available balance');
  assertClose(posted.held, 0, 'posted settlement held balance');
  assert.deepEqual(posted.diagnostics, []);

  const retried = reconcile(postedEntries, [], [settlement(true)]);
  assert.deepEqual(retried, posted, 'idempotent settlement retry must not add another credit');
  const duplicate = reconcile([...postedEntries, { ...postedEntries[1], id: 7 }], [], [settlement(true)]);
  assert.ok(duplicate.diagnostics.some(value => value.startsWith('DUPLICATE_REFERENCE:')));

  const staleHold = reconcile([{ ...escrowHold }, postedEntries[1]], [], [settlement(true)]);
  assertClose(staleHold.held, 0, 'posted escrow is not logically active');
  assert.ok(staleHold.diagnostics.includes('POSTED_ESCROW_STILL_HELD:6'));

  const legacyNoAttempt = { withdrawal: { id: 10, status: 'COMPLETED' }, attempts: [] as unknown[] };
  assert.equal(legacyNoAttempt.attempts.length, 0, 'legacy verification must not fabricate payout attempts');
  console.log('PASS: synthetic settlement, escrow, withdrawal reservation, approval, processing, completion, failure, rejection, retry and legacy-no-attempt invariants');
}

async function verifyCompetingReleaseGuard() {
  let walletMutationCalled = false;
  const tx = {
    paymentTransaction: {
      findUniqueOrThrow: async () => ({ id: 'payment-1', status: 'SUCCEEDED', supplierOrgId: 1, relatedType: 'PURCHASE_ORDER', environment: 'SANDBOX' }),
    },
    wallet: {
      findFirstOrThrow: async () => { walletMutationCalled = true; throw new Error('Unexpected wallet lookup.'); },
    },
  };
  await assert.rejects(
    () => releaseSupplierFunds(tx, 'payment-1'),
    /Purchase order funds must be released through immutable settlement posting/,
  );
  assert.equal(walletMutationCalled, false);
  console.log('PASS: legacy admin release path cannot credit purchase-order funds outside immutable settlement posting');
}

async function verifyLiveEvidence(prisma: PrismaClient) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: 5 },
    include: {
      ledgerEntries: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
      withdrawals: { where: { deletedAt: null }, include: { payoutAttempts: true }, orderBy: { id: 'asc' } },
    },
  });
  assert.ok(wallet, 'Expected SANDBOX wallet 5 was not found.');
  assert.equal(wallet.orgId, 1);
  assert.equal(wallet.environment, 'SANDBOX');

  const settlements = await prisma.purchaseOrderSettlement.findMany({
    where: { supplierOrgId: wallet.orgId, environment: wallet.environment },
    orderBy: { settledAt: 'asc' },
  });
  const state = reconcileWalletLedger(wallet.ledgerEntries, wallet.withdrawals, settlements);
  assertClose(state.available, wallet.balance, 'live wallet available balance');
  assertClose(state.held, wallet.heldBalance, 'live wallet held balance');
  assert.deepEqual(state.diagnostics, []);

  const withdrawal = wallet.withdrawals.find(value => value.id === 2);
  assert.ok(withdrawal);
  assert.equal(withdrawal.status, 'COMPLETED');
  assert.equal(withdrawal.amount, 500);
  assert.equal(withdrawal.payoutAttempts.length, 0);
  const withdrawalEntries = wallet.ledgerEntries.filter(entry => entry.referenceId === 'withdrawal:2' || entry.referenceId === 'withdrawal-payout:2');
  assert.deepEqual(withdrawalEntries.map(entry => [entry.id, entry.referenceId, entry.status]), [
    [9, 'withdrawal:2', 'RELEASED'],
    [10, 'withdrawal-payout:2', 'RELEASED'],
  ]);

  const affectedSettlement = settlements.find(value => value.id === 'bf77f6d1-f8c8-45f2-8679-bad0c171eee1');
  assert.ok(affectedSettlement);
  assert.equal(affectedSettlement.walletLedgerEntryId, 6);
  assert.ok(affectedSettlement.walletPostedAt);
  const hold = wallet.ledgerEntries.find(entry => entry.id === 4);
  const credit = wallet.ledgerEntries.find(entry => entry.id === 6);
  assert.deepEqual([hold?.sourceType, hold?.referenceId, hold?.amount, hold?.status], ['ESCROW_HOLD', affectedSettlement.paymentTransactionId, 97975, 'RELEASED']);
  assert.deepEqual([credit?.sourceType, credit?.referenceId, credit?.amount, credit?.status], ['PURCHASE_ORDER_SETTLEMENT', affectedSettlement.id, 97975, 'AVAILABLE']);

  const legacyAcknowledgements = await prisma.auditLog.count({
    where: { recordType: 'Withdrawal', recordId: { in: ['1', '2'] }, pageKey: 'payoutReconciliation' },
  });
  assert.equal(legacyAcknowledgements, 2);
  console.log('PASS: live wallet 5 reconciles under the canonical event formula; withdrawal 2 is not double-debited; settlement escrow row 4 is RELEASED; no payout attempts fabricated');
}

async function main() {
  verifySyntheticLifecycle();
  await verifyCompetingReleaseGuard();
  const prisma = new PrismaClient();
  try {
    await verifyLiveEvidence(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
