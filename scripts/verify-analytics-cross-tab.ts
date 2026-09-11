import 'dotenv/config';
import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '@prisma/client';
import { analyticsRange, getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';

type AnalyticsReport = Awaited<ReturnType<typeof getSupplierAnalytics>>;
type CapturedQuery = { query: string; params: string };

const cents = (value: number) => Math.round(value * 100);
const currentProductDiagnostics = (report: AnalyticsReport) => report.productAnalytics.diagnostics.filter((row: any) => row.period === 'current');
const currentCustomerDiagnostic = (report: AnalyticsReport) => report.customerAnalytics.diagnostics.find((row: any) => row.period === 'current');

function assertSettlementTabs(report: AnalyticsReport) {
  const fees = report.feeAnalytics.metrics;
  const products = report.productAnalytics.metrics;
  const productDiagnostics = currentProductDiagnostics(report);
  const customers = report.customerAnalytics.metrics;
  const customerDiagnostic = currentCustomerDiagnostic(report);

  assert.equal(cents(report.kpis.grossSales), cents(fees.grossSettled));
  assert.equal(cents(report.kpis.platformFees), cents(fees.platformFees));
  assert.equal(cents(report.kpis.netEarnings), cents(fees.netEarnings));
  assert.equal(cents(report.kpis.grossSales), cents(report.kpis.platformFees) + cents(report.kpis.netEarnings));
  assert.equal(cents(fees.grossSettled), cents(fees.platformFees) + cents(fees.netEarnings));
  assert.equal(
    cents(products.revenue) + productDiagnostics.reduce((sum: number, row: any) => sum + cents(row.unallocatedGross), 0),
    cents(report.kpis.grossSales),
  );
  assert.equal(
    cents(products.fees) + productDiagnostics.reduce((sum: number, row: any) => sum + cents(row.unallocatedFees), 0),
    cents(report.kpis.platformFees),
  );
  assert.equal(
    cents(products.netEarnings) + productDiagnostics.reduce((sum: number, row: any) => sum + cents(row.unallocatedNet), 0),
    cents(report.kpis.netEarnings),
  );
  assert.equal(cents(customers.revenue) + cents(customerDiagnostic?.unresolvedGross ?? 0), cents(report.kpis.grossSales));
  assert.equal(report.feeAnalytics.trend.reduce((sum: number, row: any) => sum + cents(row.platformFees), 0), cents(fees.platformFees));
  assert.equal(report.revenueTrend.reduce((sum: number, row: any) => sum + cents(row.platformFees), 0), cents(report.kpis.platformFees));
}

function summarizePlan(plan: any) {
  const nodeTypes = new Map<string, number>();
  const scans: { node: string; relation: string; index?: string; rows?: number; loops?: number }[] = [];
  const sorts: { method?: string; rows?: number }[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    const nodeType = String(node['Node Type'] ?? 'Unknown');
    nodeTypes.set(nodeType, (nodeTypes.get(nodeType) ?? 0) + 1);
    if (node['Relation Name']) scans.push({ node: nodeType, relation: node['Relation Name'], index: node['Index Name'], rows: node['Actual Rows'], loops: node['Actual Loops'] });
    if (nodeType === 'Sort') sorts.push({ method: node['Sort Method'], rows: node['Actual Rows'] });
    for (const child of node.Plans ?? []) visit(child);
  };
  visit(plan.Plan);
  return {
    planningMs: plan['Planning Time'],
    executionMs: plan['Execution Time'],
    nodeTypes: Object.fromEntries([...nodeTypes.entries()].sort()),
    scans,
    sorts,
  };
}

async function main() {
  let captured: CapturedQuery | null = null;
  const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
  prisma.$on('query', event => {
    if (!captured && /WITH\s+scope\s+AS/i.test(event.query)) captured = { query: event.query, params: event.params };
  });

  try {
    const baseline = await getSupplierAnalytics(prisma, 1, {
      startDate: '2026-08-31', endDate: '2026-08-31',
      productLimit: 100, customerLimit: 100, orderLimit: 100, feeLimit: 100, payoutLimit: 100,
    });
    assert.equal(baseline.environment, 'SANDBOX');
    assertSettlementTabs(baseline);
    assert.deepEqual(
      [baseline.kpis.grossSales, baseline.feeAnalytics.metrics.grossSettled, baseline.kpis.platformFees, baseline.kpis.netEarnings, baseline.kpis.settledOrders],
      [3458000, 3458000, 175, 3457825, 2],
    );
    assert.equal(baseline.productAnalytics.metrics.revenue, 3458000);
    assert.equal(baseline.customerAnalytics.metrics.revenue, 3458000);
    assert.equal(baseline.orderAnalytics.metrics.totalOrders, 0);
    assert.notEqual(baseline.kpis.settledOrders, baseline.orderAnalytics.metrics.totalOrders);
    process.stdout.write('PASS: live Sales, Products, Customers and Fees reconciliation; Orders createdAt cohort remains distinct.\n');

    const payoutDay = await getSupplierAnalytics(prisma, 1, { startDate: '2026-09-01', endDate: '2026-09-01', payoutLimit: 100 });
    assert.deepEqual(
      [payoutDay.payoutAnalytics.metrics.requestedCount, payoutDay.payoutAnalytics.metrics.requestedAmount,
        payoutDay.payoutAnalytics.metrics.completedCount, payoutDay.payoutAnalytics.metrics.paidOutAmount,
        payoutDay.payoutAnalytics.metrics.legacyNoAttemptCount, payoutDay.payoutAnalytics.metrics.providerAttemptCount],
      [1, 500, 2, 1400, 2, 0],
    );
    assert.notEqual(payoutDay.payoutAnalytics.metrics.paidOutAmount, payoutDay.kpis.netEarnings);
    const retryFixture = [{ amount: 10000, attempts: ['FAILED', 'SUCCEEDED'] }];
    assert.equal(retryFixture.reduce((sum, withdrawal) => sum + withdrawal.amount, 0), 10000);
    assert.equal(retryFixture.reduce((sum, withdrawal) => sum + withdrawal.attempts.length, 0), 2);
    process.stdout.write('PASS: payout event-date baseline, legacy disclosure evidence, withdrawal-level money and retry de-duplication.\n');

    const samplePo = baseline.recentOrders[0]?.poNumber;
    assert.ok(samplePo);
    for (const search of ['%', '_', "'", '"', '\\', '-', 'two words', samplePo.toLowerCase()]) {
      const filtered = await getSupplierAnalytics(prisma, 1, { startDate: '2026-08-31', endDate: '2026-08-31', search });
      assertSettlementTabs(filtered);
    }
    const exact = await getSupplierAnalytics(prisma, 1, { startDate: '2026-08-31', endDate: '2026-08-31', search: samplePo.toLowerCase() });
    assert.equal(exact.kpis.settledOrders, 1);
    process.stdout.write('PASS: parameterized literal special-character and mixed-case search keeps all settlement tabs on one population.\n');

    const range = analyticsRange('2026-08-31', '2026-08-31');
    assert.equal(range.start.toISOString(), '2026-08-30T16:00:00.000Z');
    assert.equal(range.endExclusive.toISOString(), '2026-08-31T16:00:00.000Z');
    const boundaries = await prisma.$queryRaw<{ field: string; included: number }[]>(Prisma.sql`
      WITH event_times(occurred_at) AS (VALUES
        (${new Date(range.start.valueOf() - 1)}::timestamp), (${range.start}::timestamp),
        (${new Date(range.endExclusive.valueOf() - 1)}::timestamp), (${range.endExclusive}::timestamp)
      ), fields(field) AS (SELECT unnest(ARRAY['settledAt', 'createdAt', 'buyerConfirmedAt', 'requestedAt', 'completedAt']))
      SELECT field, count(*) FILTER (WHERE occurred_at >= ${range.start} AND occurred_at < ${range.endExclusive})::int AS included
      FROM fields CROSS JOIN event_times GROUP BY field ORDER BY field
    `);
    assert.equal(boundaries.length, 5);
    assert.ok(boundaries.every(row => row.included === 2));
    process.stdout.write('PASS: Manila half-open boundaries include 00:00 and 23:59:59.999 and exclude adjacent instants for all event fields.\n');

    const empty = await getSupplierAnalytics(prisma, 1, { startDate: '2026-08-31', endDate: '2026-08-31', search: '__cross_tab_no_match_18_6__' });
    assertSettlementTabs(empty);
    assert.equal(empty.kpis.grossSales, 0);
    assert.equal(empty.feeAnalytics.metrics.effectiveFeeRate, null);
    assert.equal(empty.productAnalytics.metrics.averageSellingValue, null);
    assert.equal(empty.customerAnalytics.metrics.averageOrderValue, null);
    assert.equal(empty.customerAnalytics.metrics.repeatCustomerRate, null);
    assert.equal(empty.orderAnalytics.metrics.completionRate, null);
    assert.equal(empty.payoutAnalytics.metrics.successRate, null);
    const foreign = await getSupplierAnalytics(prisma, 2147483647, { startDate: '2026-08-31', endDate: '2026-08-31' });
    assert.equal(foreign.kpis.grossSales, 0);
    assert.equal(foreign.productAnalytics.performance.total, 0);
    assert.equal(foreign.customerAnalytics.performance.total, 0);
    assert.equal(foreign.orderAnalytics.performance.total, 0);
    assert.equal(foreign.feeAnalytics.history.total, 0);
    assert.equal(foreign.payoutAnalytics.history.total, 0);
    const originalEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const production = await getSupplierAnalytics(prisma, 1, { startDate: '2026-08-31', endDate: '2026-08-31' });
      assert.equal(production.environment, 'PRODUCTION');
      assert.equal(production.kpis.grossSales, 0);
      assert.equal(production.productAnalytics.performance.total, 0);
      assert.equal(production.customerAnalytics.performance.total, 0);
      assert.equal(production.feeAnalytics.history.total, 0);
      assert.equal(production.payoutAnalytics.history.total, 0);
    } finally {
      process.env.NODE_ENV = originalEnvironment;
    }
    process.stdout.write('PASS: zero denominators, supplier isolation and SANDBOX/PRODUCTION isolation across all tab populations.\n');

    assert.ok(captured, 'The production aggregate SQL query was not captured for EXPLAIN.');
    const query = captured as CapturedQuery;
    const parameters = JSON.parse(query.params);
    // Prisma query events serialize Date bindings as strings. Restore their
    // timestamp type when replaying the same statement through EXPLAIN.
    const explainQuery = query.query.replace(/\$(\d+)/g, (placeholder, position) => {
      const value = parameters[Number(position) - 1];
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(value)
        ? `${placeholder}::timestamp`
        : placeholder;
    });
    const explained = await prisma.$queryRawUnsafe<any[]>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${explainQuery}`, ...parameters);
    const payload = explained[0]?.['QUERY PLAN'];
    const plan = Array.isArray(payload) ? payload[0] : payload;
    assert.ok(plan?.Plan);
    const summary = summarizePlan(plan);
    assert.equal(summary.nodeTypes.ModifyTable, undefined);
    process.stdout.write(`PASS: read-only EXPLAIN ANALYZE of the complete seven-tab aggregate. ${JSON.stringify(summary)}\n`);

    const indexes = await prisma.$queryRaw<{ tablename: string; indexname: string }[]>(Prisma.sql`
      SELECT tablename, indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ANY(ARRAY[
        'PurchaseOrder', 'PurchaseOrderSettlement', 'POLineItem', 'Delivery', 'Wallet',
        'Withdrawal', 'WithdrawalPayoutAttempt', 'WalletLedgerEntry', 'AuditLog'
      ]) ORDER BY tablename, indexname
    `);
    assert.ok(indexes.some(row => row.tablename === 'PurchaseOrderSettlement' && row.indexname.includes('supplierOrgId_environment')));
    assert.ok(indexes.some(row => row.tablename === 'WithdrawalPayoutAttempt' && row.indexname.includes('withdrawalId_status')));
    process.stdout.write(`PASS: existing-index inventory captured (${indexes.length} relevant indexes); no migration inferred from the tiny local scan choices.\n`);

    for (const size of [10, 1000, 10000]) {
      const started = performance.now();
      const [scaled] = await prisma.$queryRaw<{ settlement_gross: bigint; allocated_gross: bigint; withdrawals: bigint; attempts: bigint; paid_out: bigint }[]>(Prisma.sql`
        WITH settlements AS (
          SELECT id, 10000::bigint AS gross_cents FROM generate_series(1, ${size}) id
        ), lines AS (
          SELECT settlement_id, line_id, CASE line_id WHEN 1 THEN 1 WHEN 2 THEN 2 ELSE 7 END::bigint AS weight
          FROM generate_series(1, ${size}) settlement_id CROSS JOIN generate_series(1, 3) line_id
        ), allocated AS (
          SELECT l.settlement_id, sum(s.gross_cents * l.weight / 10) AS gross_cents
          FROM lines l JOIN settlements s ON s.id = l.settlement_id GROUP BY l.settlement_id
        ), withdrawals AS (
          SELECT id, 100000::bigint AS amount_cents FROM generate_series(1, ${size}) id
        ), attempts AS (
          SELECT withdrawal_id, attempt FROM generate_series(1, ${size}) withdrawal_id CROSS JOIN generate_series(1, 2) attempt
        ), attempt_counts AS (
          SELECT w.id, w.amount_cents, count(a.attempt) AS attempts
          FROM withdrawals w LEFT JOIN attempts a ON a.withdrawal_id = w.id GROUP BY w.id, w.amount_cents
        )
        SELECT (SELECT sum(gross_cents) FROM settlements) AS settlement_gross,
          (SELECT sum(gross_cents) FROM allocated) AS allocated_gross,
          (SELECT count(*) FROM attempt_counts) AS withdrawals,
          (SELECT sum(attempts) FROM attempt_counts) AS attempts,
          (SELECT sum(amount_cents) FROM attempt_counts) AS paid_out
      `);
      assert.equal(Number(scaled.settlement_gross), Number(scaled.allocated_gross));
      assert.equal(Number(scaled.withdrawals), size);
      assert.equal(Number(scaled.attempts), size * 2);
      assert.equal(Number(scaled.paid_out), size * 100000);
      process.stdout.write(`PASS: read-only ${size.toLocaleString('en-US')}-row scale fixture reconciled product allocation and one-withdrawal payout money across two attempts in ${(performance.now() - started).toFixed(1)} ms.\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Cross-tab analytics verification failed');
  process.exitCode = 1;
});
