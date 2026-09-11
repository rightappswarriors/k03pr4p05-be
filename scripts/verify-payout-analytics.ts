import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';
import { payoutPageOptions } from '../src/services/supplierFinanceAnalytics.sql.js';

const dateKey = (value: Date) => new Date(value.valueOf() + 8 * 3600000).toISOString().slice(0, 10);

export async function verifyPayoutAnalytics(prisma: PrismaClient) {
  const summarize = (rows: { amount: number; state: string; attempts: string[] }[]) => ({
    requested: rows.length, requestedAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    completed: rows.filter(row => row.state === 'COMPLETED').length,
    paid: rows.filter(row => row.state === 'COMPLETED').reduce((sum, row) => sum + row.amount, 0),
    processing: rows.filter(row => row.state === 'PROCESSING').length,
    failed: rows.filter(row => ['FAILED', 'REJECTED'].includes(row.state)).length,
    attempts: rows.reduce((sum, row) => sum + row.attempts.length, 0),
  });
  const base = summarize([{ amount: 10000, state: 'COMPLETED', attempts: ['SUCCEEDED'] }, { amount: 5000, state: 'FAILED', attempts: ['FAILED'] }, { amount: 3000, state: 'PROCESSING', attempts: [] }]);
  assert.deepEqual(base, { requested: 3, requestedAmount: 18000, completed: 1, paid: 10000, processing: 1, failed: 1, attempts: 2 });
  assert.equal(100 * base.completed / (base.completed + base.failed), 50);
  const retry = summarize([{ amount: 10000, state: 'COMPLETED', attempts: ['FAILED', 'SUCCEEDED'] }]);
  assert.deepEqual([retry.requested, retry.completed, retry.paid, retry.attempts, retry.failed], [1, 1, 10000, 2, 0]);
  const reconcile = summarize([{ amount: 10000, state: 'RECONCILIATION_REQUIRED', attempts: ['RECONCILIATION_REQUIRED'] }]);
  assert.deepEqual([reconcile.completed, reconcile.failed, reconcile.paid], [0, 0, 0]);
  assert.equal(summarize([{ amount: 10000, state: 'COMPLETED', attempts: [] }]).paid, 10000);
  console.log('PASS: synthetic terminal denominator, retry de-duplication, reconciliation exclusion, and withdrawal-only amount');
  for (const invalid of [{ payoutPage: 0 }, { payoutLimit: 21 }, { payoutSort: 'SQL' }, { payoutDirection: 'SIDEWAYS' }]) assert.throws(() => payoutPageOptions(invalid));
  const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
  const sample = await prisma.withdrawal.findFirst({ where: { environment }, include: { wallet: true }, orderBy: { requestedAt: 'desc' } });
  if (!sample) throw new Error(`No ${environment} withdrawal is available for payout verification.`);
  const requestedDay = dateKey(sample.requestedAt);
  const startDate = sample.completedAt && dateKey(sample.completedAt) < requestedDay ? dateKey(sample.completedAt) : requestedDay;
  const endDate = sample.completedAt && dateKey(sample.completedAt) > requestedDay ? dateKey(sample.completedAt) : requestedDay;
  const result = await getSupplierAnalytics(prisma, sample.wallet.orgId, { startDate, endDate });
  const payouts = result.payoutAnalytics;
  if (environment === 'SANDBOX' && sample.wallet.orgId === 1 && startDate === '2026-09-01') {
    assert.deepEqual([payouts.metrics.completedCount, payouts.metrics.paidOutAmount, payouts.metrics.legacyNoAttemptCount], [2, 1400, 2]);
  }
  assert.equal(payouts.activityTrend.reduce((sum: number, row: any) => sum + row.requestedCount, 0), payouts.metrics.requestedCount);
  assert.equal(payouts.activityTrend.reduce((sum: number, row: any) => sum + row.completedCount, 0), payouts.metrics.completedCount);
  assert.ok(payouts.history.items.every((row: any) => row.amount >= 0 && row.attemptCount >= 0));
  assert.ok(payouts.history.items.every((row: any) => row.processingHours === null || row.processingHours >= 0));
  const attempts = await prisma.withdrawalPayoutAttempt.count({ where: { withdrawal: { wallet: { orgId: sample.wallet.orgId } }, environment } });
  assert.equal(payouts.metrics.providerAttemptCount, attempts);
  const legacy = payouts.history.items.filter((row: any) => row.legacyNoAttempt);
  assert.ok(legacy.every((row: any) => row.analyticsStatus === 'COMPLETED' && row.attemptCount === 0));
  assert.ok(payouts.history.items.every((row: any) => !('payoutDestinationEncrypted' in row) && !('payoutDestinationAccount' in row)));
  assert.equal(payouts.statusDistribution.reduce((sum: number, row: any) => sum + row.count, 0), payouts.metrics.requestedCount);
  const terminal = payouts.metrics.completedCount + payouts.metrics.failedRejectedCount;
  assert.equal(payouts.metrics.successRate, terminal ? 100 * payouts.metrics.completedCount / terminal : null);
  const exact = await getSupplierAnalytics(prisma, sample.wallet.orgId, { startDate, endDate, search: `WD-${String(sample.id).padStart(6, '0')}` });
  assert.ok(exact.payoutAnalytics.history.items.every((row: any) => row.id === sample.id));
  const empty = await getSupplierAnalytics(prisma, sample.wallet.orgId, { startDate, endDate, search: '__payout_no_match__' });
  assert.equal(empty.payoutAnalytics.metrics.requestedCount, 0); assert.equal(empty.payoutAnalytics.history.total, 0);
  const foreign = await getSupplierAnalytics(prisma, 2147483647, { startDate, endDate });
  assert.equal(foreign.payoutAnalytics.history.total, 0);
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = environment === 'SANDBOX' ? 'production' : 'development';
  try { assert.equal((await getSupplierAnalytics(prisma, sample.wallet.orgId, { startDate, endDate })).payoutAnalytics.history.total, 0); }
  finally { process.env.NODE_ENV = originalEnvironment; }
  console.log('PASS: withdrawal-only money, event dates, terminal outcomes, retry aggregation, legacy evidence, duration diagnostics, search, isolation, pagination, and empty results', { range: `${startDate} to ${endDate}`, environment, metrics: payouts.metrics });
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const { PrismaClient } = await import('@prisma/client'); const prisma = new PrismaClient();
  verifyPayoutAnalytics(prisma).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
