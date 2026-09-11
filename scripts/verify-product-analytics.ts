import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '@prisma/client';
import { productAnalyticsCTEs, productAnalyticsJSON, productPageOptions, type ProductPageInput } from '../src/services/supplierProductAnalytics.sql.js';
import { analyticsRange, getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';

const cents = (n: number) => Math.round(n * 100);
export function assertProductReconciliation(data: any) {
  const p = data.productAnalytics;
  for (const [key, financial, metrics] of [['current', data.kpis, p.metrics], ['previous', data.previousKpis, p.previousMetrics]] as const) {
    const excluded = p.diagnostics.filter((d: any) => d.period === key);
    assert.equal(cents(metrics.revenue) + excluded.reduce((sum: number, d: any) => sum + cents(d.unallocatedGross), 0), cents(financial.grossSales));
    assert.equal(cents(metrics.fees) + excluded.reduce((sum: number, d: any) => sum + cents(d.unallocatedFees), 0), cents(financial.platformFees));
    assert.equal(cents(metrics.netEarnings) + excluded.reduce((sum: number, d: any) => sum + cents(d.unallocatedNet), 0), cents(financial.netEarnings));
    assert.equal(cents(metrics.revenue), cents(metrics.fees) + cents(metrics.netEarnings));
  }
  assert.equal(p.trend.reduce((s: number, r: any) => s + cents(r.revenue), 0), cents(p.metrics.revenue));
  assert.equal(p.trend.reduce((s: number, r: any) => s + r.quantity, 0), p.metrics.quantity);
  assert.equal(p.trend.reduce((s: number, r: any) => s + r.settledOrders, 0), p.metrics.settledOrders);
  assert.equal(p.contribution.reduce((s: number, r: any) => s + cents(r.amount), 0), cents(p.metrics.revenue));
  if (p.metrics.revenue > 0) assert.ok(Math.abs(p.contribution.reduce((s: number, r: any) => s + r.percentage, 0) - 100) < 0.00001);
  for (const row of p.performance.items) assert.equal(cents(row.revenue), cents(row.fees) + cents(row.netEarnings));
}

type Line = { id: string; poId: string; supplierItemId: string; qty: number; subtotal: number; unitPrice: number; itemName: string | null; itemSku: string | null };
const line = (id: string, product = id, subtotal = 100): Line => ({ id, poId: 'po', supplierItemId: product, qty: 1, subtotal, unitPrice: subtotal, itemName: `Saved ${product}`, itemSku: `SKU-${product}` });
type FixtureOptions = ProductPageInput & { lines?: Line[]; gross?: number; fee?: number; net?: number; catalogPrice?: number; archived?: boolean; missingCatalog?: boolean; foreignCatalog?: boolean };

/** Read-only CTE fixtures shadow catalog/line tables. The production SQL extension runs unchanged.
 * No INSERT, UPDATE, DELETE, temporary table, or financial mutation is used.
 */
async function fixture(prisma: PrismaClient, options: FixtureOptions = {}) {
  const lines = options.lines ?? [line('a'), line('b'), line('c')];
  const items = options.missingCatalog ? [] : [...new Set(lines.map(l => l.supplierItemId))].map(id => ({ id, name: `Renamed ${id}`, sku: 'NEW-SKU', unit: 'piece', catalogId: 'cat', globalCategoryId: null, categoryId: null, unitPrice: options.catalogPrice ?? 150, isActive: !options.archived, deletedAt: options.archived ? '2026-09-01' : null }));
  const optionsPage = productPageOptions(options);
  const gross = options.gross ?? 100;
  const fee = options.fee ?? 1;
  const net = options.net ?? gross - fee;
  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
    WITH "POLineItem" AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(lines)}::jsonb)
      AS x(id text, "poId" text, "supplierItemId" text, qty int, subtotal float8, "unitPrice" float8, "itemName" text, "itemSku" text)),
    "SupplierItem" AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(items)}::jsonb)
      AS x(id text, name text, sku text, unit text, "catalogId" text, "globalCategoryId" text, "categoryId" text, "unitPrice" float8, "isActive" boolean, "deletedAt" text)),
    "SupplierCatalog" AS (SELECT 'cat'::text AS id, ${options.foreignCatalog ? 8 : 7}::int AS "organizationId"),
    "Category" AS (SELECT NULL::text AS id, NULL::text AS name WHERE false),
    "SupplierItemCategory" AS (SELECT NULL::text AS id, NULL::text AS name WHERE false),
    settled AS (SELECT 'settlement'::text AS id, 'po'::text AS "purchaseOrderId", '2026-08-31 04:00:00'::timestamp AS "settledAt",
      ${gross}::float8 AS "grossAmount", ${fee}::float8 AS "platformFee", ${net}::float8 AS "supplierNet"),
    periods AS (SELECT 'current'::text AS key UNION ALL SELECT 'previous'),
    buckets AS (SELECT '2026-08-31'::timestamp AS bucket),
    ${productAnalyticsCTEs(7, new Date('2026-08-30T16:00:00Z'), 'day', optionsPage)}
    SELECT ${productAnalyticsJSON(optionsPage)} AS report,
      COALESCE((SELECT json_agg(json_build_object('id', line_id, 'gross', allocated_fee + allocated_net, 'fee', allocated_fee, 'net', allocated_net) ORDER BY line_id) FROM product_allocated), '[]'::json) AS allocation
  `);
  return rows[0];
}

export async function verifyProductAnalytics(prisma: PrismaClient) {
  const equal = await fixture(prisma);
  assert.deepEqual(equal.allocation.map((l: any) => l.gross), [3334, 3333, 3333]);
  assert.deepEqual(equal.allocation.map((l: any) => l.fee), [34, 33, 33]);
  assert.deepEqual(equal.allocation.map((l: any) => l.net), [3300, 3300, 3300]);
  assert.equal(equal.report.metrics.revenue, 100);
  assert.equal(equal.report.metrics.settledOrders, 1); // Not three joined lines.
  assert.equal(equal.report.metrics.activeSellingProducts, 3);
  assert.deepEqual((await fixture(prisma, { lines: [line('c'), line('b'), line('a')] })).allocation, equal.allocation);
  for (const [gross, fee] of [[0.01, 0], [0.02, 0.01], [1, 0.99], [100, 100], [100.01, 0.02], [0, 0]]) {
    const result = await fixture(prisma, { gross, fee });
    for (const [field, amount] of [['gross', gross], ['fee', fee], ['net', gross - fee]] as const) {
      assert.equal(result.allocation.reduce((sum: number, l: any) => sum + l[field], 0), cents(amount));
    }
    for (const l of result.allocation) assert.equal(l.gross, l.fee + l.net);
  }
  const repeated = await fixture(prisma, { lines: [line('a', 'parent', 100), line('b', 'parent', 200), line('c', 'other', 700)] });
  const parent = repeated.report.performance.items.find((p: any) => p.itemId === 'parent');
  assert.equal(parent.quantity, 2); assert.equal(parent.settledOrders, 1); assert.equal(parent.revenue, 30);
  assert.equal(repeated.report.metrics.revenue, 100);
  const archived = await fixture(prisma, { archived: true, catalogPrice: 9999 });
  assert.deepEqual(archived.report.performance.items, equal.report.performance.items);
  assert.equal(archived.report.performance.items[0].name, 'Saved a');
  assert.equal(archived.report.performance.items[0].sku, 'SKU-a');
  const missing = await fixture(prisma, { missingCatalog: true });
  assert.equal(missing.report.metrics.revenue, 100); assert.equal(missing.report.performance.items[0].name, 'Saved a');
  for (const [options, reason] of [
    [{ lines: [] }, 'MISSING_LINES'], [{ lines: [line('a', 'a', 0)] }, 'ZERO_BASIS'],
    [{ lines: [line('a', 'a', -1), line('b')] }, 'INVALID_LINES'],
    [{ gross: 100, fee: 1, net: 98 }, 'INVALID_SETTLEMENT'], [{ foreignCatalog: true }, 'INVALID_LINES'],
  ] as [FixtureOptions, string][]) {
    const result = await fixture(prisma, options);
    assert.equal(result.report.metrics.revenue, 0);
    assert.equal(result.report.diagnostics[0].reason, reason);
    assert.equal(result.report.diagnostics[0].settledOrders, 1);
    assert.equal(result.report.diagnostics[0].unallocatedGross, 100);
  }
  const zeroLine = await fixture(prisma, { lines: [line('a', 'free', 0), line('b', 'paid', 100)] });
  assert.equal(zeroLine.report.performance.items.find((p: any) => p.itemId === 'free').revenue, 0);
  assert.equal(zeroLine.report.metrics.quantity, 2);
  const manyLines = Array.from({ length: 23 }, (_, i) => line(`p${String(i).padStart(2, '0')}`, undefined, i + 1));
  const first = await fixture(prisma, { lines: manyLines });
  const second = await fixture(prisma, { lines: manyLines, productPage: 2 });
  assert.equal(first.report.performance.items.length, 20); assert.equal(second.report.performance.items.length, 3);
  assert.equal(first.report.performance.total, 23); assert.equal(first.report.performance.totalPages, 2);
  assert.deepEqual(first.report.metrics, second.report.metrics); assert.deepEqual(first.report.contribution, second.report.contribution);
  assert.equal(new Set([...first.report.performance.items, ...second.report.performance.items].map(p => p.itemId)).size, 23);
  assert.equal(first.report.contribution.length, 6);
  assert.equal((await fixture(prisma, { lines: manyLines, productPage: 999 })).report.performance.page, 2);
  for (const sort of ['REVENUE', 'NET', 'QUANTITY', 'ORDERS', 'AVERAGE', 'CONTRIBUTION']) {
    const result = await fixture(prisma, { lines: manyLines, productSort: sort, productDirection: 'ASC', productLimit: 50 });
    assert.equal(result.report.performance.items.length, 23);
    assert.deepEqual(result.report.metrics, first.report.metrics);
  }
  for (const invalid of [{ productPage: 0 }, { productPage: 1.5 }, { productPage: 1000001 }, { productLimit: 21 }, { productSort: 'revenue; DROP TABLE x' }, { productSort: '__proto__' }, { productDirection: 'sideways' }]) assert.throws(() => productPageOptions(invalid));
  console.log('PASS: production SQL fixtures: exact centavos, deterministic tie-breaks, multiple products, repeated parent lines, archived/missing catalog, saved prices/names/SKUs, zero/invalid basis, pagination and sort validation. Variant snapshots are absent from POLineItem; no historical variant test claimed.');

  const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
  const settlements = await prisma.purchaseOrderSettlement.findMany({ where: { status: 'SETTLED', environment }, orderBy: { settledAt: 'desc' }, take: 20 });
  assert.ok(settlements.length, 'At least one actual settlement is required.');
  let multiProduct = false;
  for (const settlement of settlements) {
    const lines = await prisma.pOLineItem.findMany({ where: { poId: settlement.purchaseOrderId }, orderBy: { id: 'asc' } });
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: settlement.purchaseOrderId }, select: { poNumber: true } });
    const day = new Date(settlement.settledAt.valueOf() + 8 * 3600000).toISOString().slice(0, 10);
    const data = await getSupplierAnalytics(prisma, settlement.supplierOrgId, { startDate: day, endDate: day, search: po.poNumber, productLimit: 100 });
    assertProductReconciliation(data);
    const byId = new Map<string, { revenue: number; fees: number; net: number; quantity: number }>();
    // Independent integer largest-remainder oracle for real saved line weights.
    const weights = lines.map(l => BigInt(cents(l.subtotal)));
    const total = weights.reduce((a, b) => a + b, 0n);
    assert.ok(total > 0n && weights.every(w => w >= 0n), 'Real reconciliation sample must have valid weights.');
    const allocate = (value: number) => {
      const amount = BigInt(cents(value));
      const shares = weights.map((w, index) => ({ index, base: amount * w / total, remainder: amount * w % total }));
      let remaining = amount - shares.reduce((sum, s) => sum + s.base, 0n);
      const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
      for (const s of ranked) if (remaining > 0n) { s.base++; remaining--; }
      return shares.map(s => Number(s.base));
    };
    const fees = allocate(settlement.platformFee); const nets = allocate(settlement.supplierNet);
    lines.forEach((l, i) => {
      const row = byId.get(l.supplierItemId) ?? { revenue: 0, fees: 0, net: 0, quantity: 0 };
      row.revenue += fees[i] + nets[i]; row.fees += fees[i]; row.net += nets[i]; row.quantity += l.qty;
      byId.set(l.supplierItemId, row);
    });
    for (const row of data.productAnalytics.performance.items.filter((p: any) => p.settledOrders > 0)) {
      const expected = byId.get(row.itemId)!;
      assert.ok(expected); assert.equal(cents(row.revenue), expected.revenue); assert.equal(cents(row.fees), expected.fees);
      assert.equal(cents(row.netEarnings), expected.net); assert.equal(row.quantity, expected.quantity);
    }
    if (byId.size > 1) multiProduct = true;
    console.log('PASS: real PO product allocation', { day, lineCount: lines.length, products: byId.size, gross: data.productAnalytics.metrics.revenue, fees: data.productAnalytics.metrics.fees, net: data.productAnalytics.metrics.netEarnings });
    const r = analyticsRange(day, day);
    assert.ok(settlement.settledAt >= r.start && settlement.settledAt < r.endExclusive);
  }
  console.log(`Actual multi-product settlement coverage: ${multiProduct ? 'yes' : 'not present in the bounded sample; production SQL fixture tested'}. No mutations executed.`);
}

if (process.argv[1]?.endsWith('verify-product-analytics.ts')) {
  const prisma = new PrismaClient();
  verifyProductAnalytics(prisma).catch(error => {
    console.error(error instanceof Error ? error.message : 'Product verification failed');
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}
