import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PrismaClient } from '@prisma/client';
import { makeSchema } from 'nexus';
import { graphql } from 'graphql';
import * as types from '../src/graphql/resolvers/supplier/supplierAnalytics.query.js';
import { analyticsRange, getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';
import { assertProductReconciliation, verifyProductAnalytics } from './verify-product-analytics.js';
import { verifyCustomerAnalytics } from './verify-customer-analytics.js';
import { verifyOrderAnalytics } from './verify-order-analytics.js';
import { verifyFeeAnalytics } from './verify-fees-analytics.js';
import { verifyPayoutAnalytics } from './verify-payout-analytics.js';

const prisma = new PrismaClient();
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} does not reconcile with ${b}`);

async function main() {
  for (const [start, end, days, interval] of [
    ['2026-09-02', '2026-09-08', 7, 'DAILY'], ['2026-08-10', '2026-09-08', 30, 'DAILY'],
    ['2026-06-09', '2026-09-08', 92, 'WEEKLY'], ['2026-03-09', '2026-09-08', 184, 'WEEKLY'],
    ['2025-09-09', '2026-09-08', 365, 'MONTHLY'], ['2024-02-29', '2024-02-29', 1, 'DAILY'],
  ] as const) {
    const r = analyticsRange(start, end);
    assert.equal(r.days, days); assert.equal(r.interval, interval);
    assert.equal(r.start.valueOf() - r.previousStart.valueOf(), r.endExclusive.valueOf() - r.start.valueOf());
    assert.equal(r.start.toISOString().slice(11), '16:00:00.000Z');
  }
  for (const [s, e] of [['2026-02-30', '2026-03-01'], ['2026-09-09', '2026-09-08'], ['2020-01-01', '2026-09-08'], ['1', '2026-09-08']]) assert.throws(() => analyticsRange(s, e));
  console.log('PASS: presets, leap day, Manila boundaries, equal preceding periods, invalid ranges');

  const schema = makeSchema({ types: Object.values(types), outputs: false, shouldGenerateArtifacts: false });
  const source = 'query Analytics($input: SupplierAnalyticsInput!) { supplierAnalytics(input: $input) { range { startDate endDate } kpis { grossSales platformFees netEarnings settledOrders } revenueTrend { bucket settledOrders } } }';
  const input = { startDate: '2026-09-01', endDate: '2026-09-08' };
  const unauthorized = await graphql({ schema, source, variableValues: { input }, contextValue: { prisma, user: null } });
  assert.ok(unauthorized.errors?.length);
  const badContract = await graphql({ schema, source, variableValues: { input: { ...input, orgId: 1 } } });
  assert.ok(badContract.errors?.length);
  const numericDate = await graphql({ schema, source, variableValues: { input: { ...input, startDate: 1 } } });
  assert.ok(numericDate.errors?.length);
  console.log('PASS: GraphQL schema, unauthorized access, client organization argument rejection, numeric-date rejection');

  const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
  const sample = await prisma.purchaseOrderSettlement.findFirst({ where: { environment }, orderBy: { settledAt: 'desc' } });
  if (!sample) throw new Error(`No actual ${environment} settlement available for financial reconciliation.`);
  const day = new Date(sample.settledAt.valueOf() + 8 * 3600000).toISOString().slice(0, 10);
  const report = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day });
  assertProductReconciliation(report);
  const clientSource = await readFile(new URL('../../k03pr4p05-fe/services/supplierService/supplierAnalyticsService.ts', import.meta.url), 'utf8');
  const clientQuery = clientSource.match(/export const SUPPLIER_ANALYTICS_QUERY = gql`([\s\S]*?)`/)?.[1];
  assert.ok(clientQuery);
  const context = { prisma, user: { orgId: sample.supplierOrgId, role: 'SUPPLIER', approvalStatus: 'APPROVED' } };
  const clientResult = await graphql({ schema, source: clientQuery, variableValues: { input: { startDate: day, endDate: day } }, contextValue: context });
  assert.equal(clientResult.errors, undefined);
  assertProductReconciliation(clientResult.data?.supplierAnalytics);
  for (const invalid of [{ productPage: 0 }, { productLimit: 21 }, { productSort: 'malicious SQL' }, { productDirection: 'sideways' }]) {
    const result = await graphql({ schema, source: clientQuery, variableValues: { input: { startDate: day, endDate: day, ...invalid } }, contextValue: context });
    assert.ok(result.errors?.length);
  }
  for (const invalid of [{ customerPage: 0 }, { customerLimit: 21 }, { customerSort: 'malicious SQL' }, { customerDirection: 'sideways' }]) {
    const result = await graphql({ schema, source: clientQuery, variableValues: { input: { startDate: day, endDate: day, ...invalid } }, contextValue: context });
    assert.ok(result.errors?.length);
  }
  for (const invalid of [{ feePage: 0 }, { feeLimit: 21 }, { feeSort: 'malicious SQL' }, { feeDirection: 'sideways' },
    { payoutPage: 0 }, { payoutLimit: 21 }, { payoutSort: 'malicious SQL' }, { payoutDirection: 'sideways' }]) {
    const result = await graphql({ schema, source: clientQuery, variableValues: { input: { startDate: day, endDate: day, ...invalid } }, contextValue: context });
    assert.ok(result.errors?.length);
  }
  // Exercise the actual client CSV serializer without loading native authentication/network code.
  const compiled = ts.transpileModule(clientSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const clientExports: any = {};
  new Function('require', 'exports', compiled)((name: string) => name === 'graphql-request' ? { gql: (parts: TemplateStringsArray) => parts[0] } : {}, clientExports);
  const csvData = structuredClone(report);
  if (csvData.productAnalytics.performance.items.length) {
    csvData.productAnalytics.performance.items[0].name = '=HYPERLINK("unsafe")';
    csvData.productAnalytics.performance.items[0].sku = '+SUM(1,1),"quoted"\nline';
  }
  if (csvData.customerAnalytics.performance.items.length) csvData.customerAnalytics.performance.items[0].displayName = '@unsafe';
  if (csvData.topCustomers.length) csvData.topCustomers[0].name = '-unsafe';
  const csv = clientExports.analyticsCSV(csvData, 'Supplier');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('PRODUCT ANALYTICS') && csv.includes('CUSTOMER ANALYTICS') && csv.includes('FEES ANALYTICS') && csv.includes('PAYOUTS ANALYTICS') && csv.includes('loaded page only'));
  assert.ok(csv.includes("'=HYPERLINK") && csv.includes("'+SUM(1,1),\"\"quoted\"\"\nline") && csv.includes("'@unsafe") && csv.includes("'-unsafe"));
  console.log('PASS: actual frontend GraphQL query and analytics fragments, all analytics page/sort input rejection, CSV escaping/formula protection and page-scope labelling');
  const range = analyticsRange(day, day);
  const evidence = await prisma.purchaseOrderSettlement.aggregate({ where: { supplierOrgId: sample.supplierOrgId, environment, status: 'SETTLED', settledAt: { gte: range.start, lt: range.endExclusive } }, _sum: { grossAmount: true, platformFee: true, supplierNet: true } });
  close(sample.grossAmount, sample.platformFee + sample.supplierNet);
  close(report.kpis.grossSales, evidence._sum.grossAmount ?? 0);
  close(report.kpis.platformFees, evidence._sum.platformFee ?? 0);
  close(report.kpis.netEarnings, evidence._sum.supplierNet ?? 0);
  close(report.kpis.grossSales, report.kpis.platformFees + report.kpis.netEarnings);
  const count = await prisma.purchaseOrderSettlement.count({ where: { supplierOrgId: sample.supplierOrgId, environment, status: 'SETTLED', settledAt: { gte: range.start, lt: range.endExclusive } } });
  assert.equal(report.kpis.settledOrders, count);
  assert.ok(count > 0);
  close(report.kpis.grossSales / report.kpis.settledOrders, (evidence._sum.grossAmount ?? 0) / count);
  close(report.revenueTrend.reduce((s: number, p: any) => s + p.grossSales, 0), report.kpis.grossSales);
  assert.ok(report.recentOrders.length <= 5 && report.topProducts.length <= 5 && report.topCustomers.length <= 5);
  assert.equal(report.revenueTrend.length, 1);
  console.log('PASS: actual settlement reconciliation', { day, environment, sample: { gross: sample.grossAmount, fees: sample.platformFee, net: sample.supplierNet }, dashboard: report.kpis });

  for (const search of ['__analytics_no_match_98431__', '%__analytics_no_match_98431__', "' OR 1=1 --"]) {
    const empty = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day, search });
    assert.equal(empty.kpis.grossSales, 0); assert.equal(empty.recentOrders.length, 0); assert.equal(empty.revenueTrend[0].grossSales, 0);
    assert.equal(empty.kpis.settledOrders, 0); assert.equal(empty.revenueTrend[0].settledOrders, 0);
    assertProductReconciliation(empty); assert.equal(empty.productAnalytics.performance.total, 0);
  }
  const foreign = await getSupplierAnalytics(prisma, 2147483647, { startDate: day, endDate: day });
  assert.equal(foreign.kpis.grossSales, 0); assert.equal(foreign.topCustomers.length, 0);
  assertProductReconciliation(foreign); assert.equal(foreign.productAnalytics.performance.total, 0);
  console.log('PASS: literal search, injection resistance, empty buckets, supplier isolation');

  for (const [startDate, endDate, interval] of [
    ['2026-09-02', '2026-09-08', 'DAILY'], ['2026-08-10', '2026-09-08', 'DAILY'],
    ['2026-06-09', '2026-09-08', 'WEEKLY'], ['2026-03-09', '2026-09-08', 'WEEKLY'],
    ['2025-09-09', '2026-09-08', 'MONTHLY'],
  ]) {
    const actual = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate, endDate });
    assert.equal(actual.interval, interval);
    assertProductReconciliation(actual);
    assert.ok(actual.revenueTrend.length > 1 && actual.revenueTrend.length <= 32);
    const dates = actual.revenueTrend.map((p: any) => p.bucket);
    assert.deepEqual(dates, [...new Set(dates)].sort());
    close(actual.revenueTrend.reduce((sum: number, p: any) => sum + p.grossSales, 0), actual.kpis.grossSales);
    close(actual.revenueTrend.reduce((sum: number, p: any) => sum + p.platformFees, 0), actual.kpis.platformFees);
    close(actual.revenueTrend.reduce((sum: number, p: any) => sum + p.netEarnings, 0), actual.kpis.netEarnings);
    assert.equal(actual.revenueTrend.reduce((sum: number, p: any) => sum + p.settledOrders, 0), actual.kpis.settledOrders);
    const period = analyticsRange(startDate, endDate);
    for (const [metrics, first, last] of [[actual.kpis, period.start, period.endExclusive], [actual.previousKpis, period.previousStart, period.start]] as const) {
      const evidence = await prisma.purchaseOrderSettlement.aggregate({ where: { supplierOrgId: sample.supplierOrgId, environment, status: 'SETTLED', settledAt: { gte: first, lt: last } }, _count: true, _sum: { grossAmount: true } });
      assert.equal(metrics.settledOrders, evidence._count);
      if (evidence._count) close(metrics.grossSales / metrics.settledOrders, (evidence._sum.grossAmount ?? 0) / evidence._count);
    }
    assert.equal(actual.orderStatuses.reduce((sum: number, s: any) => sum + s.count, 0), actual.kpis.totalOrders);
  }
  console.log('PASS: all five preset SQL bucket series reconcile; unique chronological buckets; status counts reconcile');

  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: sample.purchaseOrderId }, select: { poNumber: true } });
  const exact = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day, search: po.poNumber });
  close(exact.kpis.netEarnings, sample.supplierNet);
  assert.equal(exact.kpis.settledOrders, 1);
  assertProductReconciliation(exact);
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = environment === 'SANDBOX' ? 'production' : 'development';
  try {
    const other = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day, search: po.poNumber });
    assert.equal(other.kpis.grossSales, 0);
    assert.equal(other.kpis.settledOrders, 0);
    assertProductReconciliation(other); assert.equal(other.productAnalytics.performance.total, 0);
  } finally { process.env.NODE_ENV = previousEnv; }
  console.log('PASS: exact PO filter, SANDBOX/PRODUCTION isolation. No mutations executed.');
  await verifyProductAnalytics(prisma);
  await verifyCustomerAnalytics(prisma);
  await verifyOrderAnalytics(prisma);
  await verifyFeeAnalytics(prisma);
  await verifyPayoutAnalytics(prisma);
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Analytics verification failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
