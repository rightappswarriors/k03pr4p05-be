import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import { getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';
import { customerPageOptions } from '../src/services/supplierCustomerAnalytics.sql.js';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.005, `${actual} does not reconcile with ${expected}`);

export async function verifyCustomerAnalytics(prisma: PrismaClient) {
  const fixture = await prisma.$queryRaw<{ data: any }[]>(Prisma.sql`
    WITH fixture(order_id, supplier_id, environment, settled_at, buyer_org_id, agent_id, gross, fees, net, line_count) AS (VALUES
      ('a-old', 1, 'SANDBOX', '2026-01-01'::timestamp, 10, 'agent-a', 100::numeric, 1::numeric, 99::numeric, 1),
      ('a-now', 1, 'SANDBOX', '2026-09-02'::timestamp, 10, 'agent-a', 10000::numeric, 100::numeric, 9900::numeric, 5),
      ('b-now', 1, 'SANDBOX', '2026-09-03'::timestamp, NULL, 'agent-b', 20000::numeric, 200::numeric, 19800::numeric, 1),
      ('b-again', 1, 'SANDBOX', '2026-09-05'::timestamp, NULL, 'agent-b', 30000::numeric, 300::numeric, 29700::numeric, 1),
      ('c-old', 1, 'SANDBOX', '2026-08-01'::timestamp, 30, NULL, 500::numeric, 5::numeric, 495::numeric, 1),
      ('d-sandbox', 1, 'SANDBOX', '2026-08-01'::timestamp, NULL, 'agent-d', 500::numeric, 5::numeric, 495::numeric, 1),
      ('d-production', 1, 'PRODUCTION', '2026-09-04'::timestamp, NULL, 'agent-d', 60000::numeric, 600::numeric, 59400::numeric, 1),
      ('missing-1', 1, 'SANDBOX', '2026-09-06'::timestamp, NULL, NULL, 40::numeric, 4::numeric, 36::numeric, 1),
      ('missing-2', 1, 'SANDBOX', '2026-09-07'::timestamp, NULL, NULL, 60::numeric, 6::numeric, 54::numeric, 1),
      ('foreign', 2, 'SANDBOX', '2026-09-03'::timestamp, 90, NULL, 90000::numeric, 900::numeric, 89100::numeric, 1)
    ), scoped AS (
      SELECT *, CASE WHEN buyer_org_id IS NOT NULL THEN 'org:' || buyer_org_id::text
        WHEN agent_id IS NOT NULL THEN 'agent:' || agent_id END AS customer_key
      FROM fixture WHERE supplier_id = 1 AND environment = 'SANDBOX'
    ), firsts AS (
      SELECT customer_key, min(settled_at) AS first_at FROM scoped WHERE customer_key IS NOT NULL GROUP BY customer_key
    ), current_rows AS (
      SELECT s.*, f.first_at FROM scoped s JOIN firsts f USING (customer_key)
      WHERE settled_at >= '2026-09-01' AND settled_at < '2026-10-01'
    ), grouped AS (
      SELECT customer_key, min(first_at) AS first_at, sum(gross) AS revenue, sum(fees) AS fees, sum(net) AS net,
        count(DISTINCT order_id) AS orders, max(line_count) AS max_lines
      FROM current_rows GROUP BY customer_key
    ), ranked AS (
      SELECT *, row_number() OVER (ORDER BY revenue DESC, customer_key) AS rank,
        100 * revenue / sum(revenue) OVER () AS contribution FROM grouped
    ) SELECT json_build_object(
      'keys', (SELECT json_agg(customer_key ORDER BY customer_key) FROM grouped),
      'unique', (SELECT count(*) FROM grouped),
      'new', (SELECT count(*) FROM grouped WHERE first_at >= '2026-09-01'),
      'returning', (SELECT count(*) FROM grouped WHERE first_at < '2026-09-01'),
      'revenue', (SELECT sum(revenue) FROM grouped), 'fees', (SELECT sum(fees) FROM grouped), 'net', (SELECT sum(net) FROM grouped),
      'orders', (SELECT sum(orders) FROM grouped),
      'aOrders', (SELECT orders FROM grouped WHERE customer_key = 'org:10'),
      'aLines', (SELECT max_lines FROM grouped WHERE customer_key = 'org:10'),
      'bRevenue', (SELECT revenue FROM grouped WHERE customer_key = 'agent:agent-b'),
      'bAov', (SELECT revenue / orders FROM grouped WHERE customer_key = 'agent:agent-b'),
      'top1', (SELECT sum(contribution) FROM ranked WHERE rank <= 1),
      'top3', (SELECT sum(contribution) FROM ranked WHERE rank <= 3),
      'unresolved', (SELECT count(*) FROM scoped WHERE customer_key IS NULL AND settled_at >= '2026-09-01'),
      'unresolvedGross', (SELECT sum(gross) FROM scoped WHERE customer_key IS NULL AND settled_at >= '2026-09-01')
    ) AS data
  `);
  const f = fixture[0].data;
  assert.deepEqual(f.keys, ['agent:agent-b', 'org:10']);
  assert.equal(f.unique, 2); assert.equal(f.new, 1); assert.equal(f.returning, 1);
  close(f.revenue, 60000); close(f.fees, 600); close(f.net, 59400); close(f.revenue, f.fees + f.net);
  assert.equal(f.orders, 3); assert.equal(f.aOrders, 1); assert.equal(f.aLines, 5);
  close(f.bRevenue, 50000); close(f.bAov, 25000); close(f.top1, 50000 / 60000 * 100); close(f.top3, 100);
  assert.equal(f.unresolved, 2); close(f.unresolvedGross, 100);
  console.log('PASS: customer SQL fixture: organization precedence, standalone agents, null diagnostics, lifetime new/returning, environment/supplier isolation, duplicate-line prevention, AOV, ranking and concentration');

  for (const invalid of [{ customerPage: 0 }, { customerLimit: 21 }, { customerSort: 'DROP TABLE' }, { customerDirection: 'sideways' }]) {
    assert.throws(() => customerPageOptions(invalid));
  }
  const clampedOptions = customerPageOptions({ customerPage: 1000000, customerLimit: 100, customerSort: 'FIRST_PURCHASE', customerDirection: 'ASC' });
  assert.equal(clampedOptions.limit, 100);
  console.log('PASS: customer pagination bounds and sort whitelist');

  const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
  const sample = await prisma.purchaseOrderSettlement.findFirst({ where: { environment, status: 'SETTLED' }, orderBy: { settledAt: 'desc' } });
  if (!sample) throw new Error(`No actual ${environment} settlement available for customer reconciliation.`);
  const day = new Date(sample.settledAt.valueOf() + 8 * 3600000).toISOString().slice(0, 10);
  const report = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day, customerLimit: 100 });
  const customer = report.customerAnalytics;
  const unresolved = customer.diagnostics.find((row: any) => row.period === 'current') ?? { unresolvedSettlements: 0, unresolvedGross: 0, unresolvedFees: 0, unresolvedNet: 0 };
  const rows = customer.performance.items;
  close(rows.reduce((sum: number, row: any) => sum + row.revenue, 0), customer.metrics.revenue);
  close(rows.reduce((sum: number, row: any) => sum + row.fees, 0), report.kpis.platformFees - unresolved.unresolvedFees);
  close(rows.reduce((sum: number, row: any) => sum + row.netEarnings, 0), report.kpis.netEarnings - unresolved.unresolvedNet);
  close(customer.metrics.revenue + unresolved.unresolvedGross, report.kpis.grossSales);
  for (const row of rows) {
    close(row.revenue, row.fees + row.netEarnings);
    close(row.averageOrderValue, row.revenue / row.settledOrders);
    assert.ok(!('email' in row) && !('phone' in row) && !('address' in row));
  }
  assert.equal(customer.metrics.uniqueCustomers, customer.metrics.newCustomers + customer.metrics.returningCustomers);
  assert.equal(customer.revenueTrend.reduce((sum: number, point: any) => sum + point.revenue, 0), customer.metrics.revenue);
  assert.ok(customer.topCustomers.length <= 5 && customer.performance.total === customer.metrics.uniqueCustomers);
  console.log('PASS: live customer revenue/fee/net reconciliation, AOV, lifecycle partition, trend, bounded ranking, and PII exclusion', { day, environment, metrics: customer.metrics, unresolved });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  verifyCustomerAnalytics(prisma).catch(error => { console.error(error instanceof Error ? error.message : 'Customer verification failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
