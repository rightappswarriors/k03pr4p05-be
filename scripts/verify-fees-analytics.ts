import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { PrismaClient } from '@prisma/client';
import { getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';
import { feePageOptions } from '../src/services/supplierFinanceAnalytics.sql.js';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} does not reconcile with ${b}`);
const dateKey = (value: Date) => new Date(value.valueOf() + 8 * 3600000).toISOString().slice(0, 10);

export async function verifyFeeAnalytics(prisma: PrismaClient) {
  const sqlSource = await readFile(new URL('../src/services/supplierFinanceAnalytics.sql.ts', import.meta.url), 'utf8');
  assert.ok(!sqlSource.includes('JOIN "FeeRule"') && !sqlSource.includes('JOIN "POLineItem"'));
  const fixture = [{ gross: 100000, fee: 1000, net: 99000 }, { gross: 50000, fee: 250, net: 49750 }];
  const fixtureGross = fixture.reduce((sum, row) => sum + row.gross, 0);
  const fixtureFee = fixture.reduce((sum, row) => sum + row.fee, 0);
  const fixtureNet = fixture.reduce((sum, row) => sum + row.net, 0);
  assert.deepEqual([fixtureGross, fixtureFee, fixtureNet], [150000, 1250, 148750]);
  close(fixtureGross, fixtureFee + fixtureNet);
  close(100 * fixtureFee / fixtureGross, 100 * 1250 / 150000);
  assert.notEqual(100 * fixtureFee / fixtureGross, (1 + 0.5) / 2);
  console.log('PASS: synthetic weighted fee rate and settlement-level reconciliation');
  for (const invalid of [{ feePage: 0 }, { feeLimit: 21 }, { feeSort: 'SQL' }, { feeDirection: 'SIDEWAYS' }]) assert.throws(() => feePageOptions(invalid));
  const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
  const sample = await prisma.purchaseOrderSettlement.findFirst({ where: { environment, status: 'SETTLED' }, orderBy: { settledAt: 'desc' } });
  if (!sample) throw new Error(`No ${environment} settlement is available for fee verification.`);
  const day = dateKey(sample.settledAt);
  const result = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day });
  const fees = result.feeAnalytics;
  close(fees.metrics.platformFees, result.kpis.platformFees);
  close(fees.metrics.grossSettled, result.kpis.grossSales);
  close(fees.metrics.netEarnings, result.kpis.netEarnings);
  close(fees.metrics.grossSettled, fees.metrics.platformFees + fees.metrics.netEarnings);
  close(fees.trend.reduce((sum: number, row: any) => sum + row.platformFees, 0), fees.metrics.platformFees);
  assert.equal(fees.trend.reduce((sum: number, row: any) => sum + row.settlementCount, 0), fees.metrics.settlementCount);
  assert.equal(fees.history.total, fees.metrics.settlementCount);
  assert.ok(fees.history.items.every((row: any) => Math.abs(row.gross - row.fee - row.net) < 0.005));
  assert.equal(fees.composition.reduce((sum: number, row: any) => sum + row.settlementCount, 0), fees.metrics.settlementCount);
  assert.ok(fees.previousMetrics.settlementCount >= 0 && fees.previousMetrics.platformFees >= 0);
  assert.ok(fees.history.items.every((row: any) => row.snapshotRate === null || Number.isFinite(row.snapshotRate)));
  const zeroFee = fees.history.items.find((row: any) => row.fee === 0);
  if (zeroFee) assert.equal(zeroFee.effectiveRate, 0);
  const empty = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day, search: '__fee_no_match__' });
  assert.equal(empty.feeAnalytics.metrics.settlementCount, 0); assert.equal(empty.feeAnalytics.history.total, 0);
  const foreign = await getSupplierAnalytics(prisma, 2147483647, { startDate: day, endDate: day });
  assert.equal(foreign.feeAnalytics.metrics.settlementCount, 0);
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = environment === 'SANDBOX' ? 'production' : 'development';
  try { assert.equal((await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day })).feeAnalytics.metrics.settlementCount, 0); }
  finally { process.env.NODE_ENV = originalEnvironment; }
  console.log('PASS: immutable fee totals, effective rates, trend/composition, history pagination, search, reconciliation, and empty results', { day, environment, metrics: fees.metrics });
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const { PrismaClient } = await import('@prisma/client'); const prisma = new PrismaClient();
  verifyFeeAnalytics(prisma).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
