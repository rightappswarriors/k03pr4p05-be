import { Prisma } from '@prisma/client';

export interface ProductPageInput { productPage?: number | null; productLimit?: number | null; productSort?: string | null; productDirection?: string | null }
export function productPageOptions(input: ProductPageInput) {
  const page = input.productPage ?? 1;
  const limit = input.productLimit ?? 20;
  const sort = input.productSort ?? 'REVENUE';
  const direction = input.productDirection ?? 'DESC';
  const columns: Record<string, string> = { REVENUE: 'revenue', NET: '"netEarnings"', QUANTITY: 'quantity', ORDERS: '"settledOrders"', AVERAGE: '"averageSellingValue"', CONTRIBUTION: 'contribution' };
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new Error('Invalid product page.');
  if (![20, 50, 100].includes(limit)) throw new Error('Invalid product page size.');
  if (!Object.prototype.hasOwnProperty.call(columns, sort) || !['ASC', 'DESC'].includes(direction)) throw new Error('Invalid product sort.');
  return { page, limit, sort, direction, order: Prisma.raw(`${columns[sort]} ${direction} NULLS LAST, "itemId" ASC`) };
}

/** Consumes product_raw, one row per historical PO line (including a null line for missing lines).
 * Largest remainders use exact numeric multiplication/mod/div and stable line IDs.
 * Round fee and supplier-net components, then ADD them for gross. This coherent rounding
 * preserves every settlement total AND line gross = fee + net (three independent roundings do not).
 * A gross share can differ by one cent from independently rounding gross; no cent is lost.
 * Invalid settlements are diagnosed in full, never silently spread equally or mutated.
 */
export const productAllocationCTEs = Prisma.sql`
  product_basis AS (
    SELECT settlement_id, max(gross_cents) AS gross_cents, max(fee_cents) AS fee_cents, max(net_cents) AS net_cents,
      sum(basis) AS total_basis,
      CASE WHEN count(line_id) = 0 THEN 'MISSING_LINES'
        WHEN bool_or(NOT amount_valid) THEN 'INVALID_SETTLEMENT'
        WHEN bool_or(basis IS NULL OR basis < 0 OR quantity < 0 OR NOT item_owned) THEN 'INVALID_LINES'
        WHEN sum(basis) <= 0 THEN 'ZERO_BASIS' END AS reason
    FROM product_raw GROUP BY settlement_id
  ), product_shares AS (
    SELECT r.*, b.total_basis,
      div(r.basis * r.fee_cents, b.total_basis) AS fee_base,
      div(r.basis * r.net_cents, b.total_basis) AS net_base,
      row_number() OVER (PARTITION BY r.settlement_id ORDER BY mod(r.basis * r.fee_cents, b.total_basis) DESC, r.line_id COLLATE "C") AS fee_rank,
      row_number() OVER (PARTITION BY r.settlement_id ORDER BY mod(r.basis * r.net_cents, b.total_basis) DESC, r.line_id COLLATE "C") AS net_rank
    FROM product_raw r JOIN product_basis b USING (settlement_id) WHERE b.reason IS NULL
  ), product_allocated AS (
    SELECT s.*,
      fee_base + CASE WHEN fee_rank <= fee_cents - sum(fee_base) OVER (PARTITION BY settlement_id) THEN 1 ELSE 0 END AS allocated_fee,
      net_base + CASE WHEN net_rank <= net_cents - sum(net_base) OVER (PARTITION BY settlement_id) THEN 1 ELSE 0 END AS allocated_net
    FROM product_shares s
  )
`;

/** Extension of the Day 18 statement: settled, periods and buckets are its existing CTEs. */
export function productAnalyticsCTEs(orgId: number, start: Date, unit: string, options: ReturnType<typeof productPageOptions>) {
  return Prisma.sql`
  product_raw AS (
    SELECT s.id AS settlement_id, s."purchaseOrderId" AS po_id, s."settledAt" AS settled_at,
      CASE WHEN s."settledAt" >= ${start} THEN 'current' ELSE 'previous' END AS period,
      l.id AS line_id, COALESCE(NULLIF(l."supplierItemId", ''), 'line:' || l.id) AS item_id,
      COALESCE(NULLIF(l."itemName", ''), i.name, 'Historical product') AS name,
      COALESCE(NULLIF(l."itemSku", ''), i.sku, '') AS sku, COALESCE(i.unit, 'unit unavailable') AS unit,
      COALESCE(c.name, lc.name, 'Uncategorised') AS category,
      (i.id IS NULL OR cat."organizationId" = ${orgId}) AS item_owned,
      l.qty AS quantity,
      CASE WHEN l.subtotal::text NOT IN ('NaN', 'Infinity', '-Infinity') THEN l.subtotal::numeric END AS basis,
      CASE WHEN s."grossAmount"::text NOT IN ('NaN', 'Infinity', '-Infinity') THEN round(s."grossAmount"::numeric * 100) ELSE 0 END AS gross_cents,
      CASE WHEN s."platformFee"::text NOT IN ('NaN', 'Infinity', '-Infinity') THEN round(s."platformFee"::numeric * 100) ELSE 0 END AS fee_cents,
      CASE WHEN s."supplierNet"::text NOT IN ('NaN', 'Infinity', '-Infinity') THEN round(s."supplierNet"::numeric * 100) ELSE 0 END AS net_cents,
      (s."grossAmount" >= 0 AND s."platformFee" >= 0 AND s."supplierNet" >= 0
        AND s."grossAmount"::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND s."platformFee"::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND s."supplierNet"::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND round(s."grossAmount"::numeric * 100) = round(s."platformFee"::numeric * 100) + round(s."supplierNet"::numeric * 100)) AS amount_valid
    FROM settled s LEFT JOIN "POLineItem" l ON l."poId" = s."purchaseOrderId"
    LEFT JOIN "SupplierItem" i ON i.id = l."supplierItemId"
    LEFT JOIN "SupplierCatalog" cat ON cat.id = i."catalogId"
    LEFT JOIN "Category" c ON c.id = i."globalCategoryId"
    LEFT JOIN "SupplierItemCategory" lc ON lc.id = i."categoryId"
  ), ${productAllocationCTEs}, product_activity AS (
    SELECT r.*, COALESCE(a.allocated_fee, 0) AS allocated_fee, COALESCE(a.allocated_net, 0) AS allocated_net
    FROM product_raw r LEFT JOIN product_allocated a ON a.settlement_id = r.settlement_id AND a.line_id = r.line_id
    WHERE r.line_id IS NOT NULL AND r.item_owned AND r.quantity >= 0
  ), product_grouped AS (
    SELECT period, item_id,
      (array_agg(name ORDER BY settled_at DESC, line_id COLLATE "C"))[1] AS name,
      (array_agg(sku ORDER BY settled_at DESC, line_id COLLATE "C"))[1] AS sku,
      max(unit) AS unit, max(category) AS category,
      sum(allocated_fee + allocated_net) / 100 AS revenue, sum(allocated_fee) / 100 AS fees,
      sum(allocated_net) / 100 AS net, sum(quantity) AS quantity, count(DISTINCT po_id) AS orders
    FROM product_activity GROUP BY period, item_id
  ), product_metrics AS (
    SELECT p.key, json_build_object(
      'revenue', COALESCE(sum(g.revenue), 0), 'fees', COALESCE(sum(g.fees), 0), 'netEarnings', COALESCE(sum(g.net), 0),
      'quantity', COALESCE(sum(g.quantity), 0),
      'settledOrders', (SELECT count(DISTINCT po_id) FROM product_activity a WHERE a.period = p.key),
      'activeSellingProducts', count(g.item_id) FILTER (WHERE g.quantity > 0 OR g.revenue > 0),
      'averageSellingValue', sum(g.revenue) / NULLIF(sum(g.quantity), 0),
      'topProductContribution', COALESCE(100 * max(g.revenue) / NULLIF(sum(g.revenue), 0), 0)
    ) AS value FROM periods p LEFT JOIN product_grouped g ON g.period = p.key GROUP BY p.key
  ), product_rows AS (
    SELECT COALESCE(c.item_id, p.item_id) AS "itemId", COALESCE(c.name, p.name) AS name,
      COALESCE(c.sku, p.sku) AS sku, COALESCE(c.unit, p.unit) AS unit, COALESCE(c.category, p.category) AS category,
      COALESCE(c.revenue, 0) AS revenue, COALESCE(c.fees, 0) AS fees, COALESCE(c.net, 0) AS "netEarnings",
      COALESCE(c.quantity, 0) AS quantity, COALESCE(c.orders, 0) AS "settledOrders",
      c.revenue / NULLIF(c.quantity, 0) AS "averageSellingValue", COALESCE(p.revenue, 0) AS "previousRevenue",
      COALESCE(100 * c.revenue / NULLIF((SELECT sum(revenue) FROM product_grouped WHERE period = 'current'), 0), 0) AS contribution
    FROM (SELECT * FROM product_grouped WHERE period = 'current') c
    FULL JOIN (SELECT * FROM product_grouped WHERE period = 'previous') p USING (item_id)
  ), product_ranked AS (
    SELECT r.*, row_number() OVER (ORDER BY revenue DESC, "itemId") AS rank FROM product_rows r WHERE revenue > 0
  ), product_contribution AS (
    SELECT CASE WHEN rank <= 5 THEN "itemId" ELSE 'others' END AS key,
      CASE WHEN rank <= 5 THEN name ELSE 'Others' END AS name, sum(revenue) AS amount, sum(contribution) AS percentage
    FROM product_ranked GROUP BY 1, 2
  ), product_trend AS (
    SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
      COALESCE(sum(a.allocated_fee + a.allocated_net), 0) / 100 AS revenue,
      COALESCE(sum(a.quantity), 0) AS quantity, count(DISTINCT a.po_id) AS "settledOrders"
    FROM buckets b LEFT JOIN product_activity a ON a.period = 'current'
      AND date_trunc(${unit}, a.settled_at + interval '8 hours') = b.bucket GROUP BY b.bucket
  ), product_diagnostics AS (
    SELECT r.period, b.reason, count(DISTINCT b.settlement_id) AS "settledOrders",
      sum(b.gross_cents) / 100 AS "unallocatedGross", sum(b.fee_cents) / 100 AS "unallocatedFees", sum(b.net_cents) / 100 AS "unallocatedNet"
    FROM product_basis b JOIN (SELECT DISTINCT settlement_id, period FROM product_raw) r USING (settlement_id)
    WHERE b.reason IS NOT NULL GROUP BY r.period, b.reason
  ), product_page_meta AS (
    SELECT count(*) AS total, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int AS total_pages,
      LEAST(${options.page}, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int) AS page FROM product_rows
  ), product_page AS (
    SELECT * FROM product_rows ORDER BY ${options.order} LIMIT ${options.limit}
    OFFSET (SELECT (page - 1) * ${options.limit} FROM product_page_meta)
  )`;
}

export function productAnalyticsJSON(options: ReturnType<typeof productPageOptions>) {
  return Prisma.sql`json_build_object(
    'metrics', (SELECT value FROM product_metrics WHERE key = 'current'),
    'previousMetrics', (SELECT value FROM product_metrics WHERE key = 'previous'),
    'trend', COALESCE((SELECT json_agg(t ORDER BY bucket) FROM product_trend t), '[]'::json),
    'topProducts', COALESCE((SELECT json_agg(t ORDER BY revenue DESC, "itemId") FROM (SELECT * FROM product_rows WHERE quantity > 0 OR revenue > 0 ORDER BY revenue DESC, "itemId" LIMIT 5) t), '[]'::json),
    'quantityLeaders', COALESCE((SELECT json_agg(t ORDER BY quantity DESC, "itemId") FROM (SELECT * FROM product_rows WHERE quantity > 0 ORDER BY quantity DESC, "itemId" LIMIT 10) t), '[]'::json),
    'contribution', COALESCE((SELECT json_agg(c ORDER BY amount DESC, key) FROM product_contribution c), '[]'::json),
    'diagnostics', COALESCE((SELECT json_agg(d ORDER BY period, reason) FROM product_diagnostics d), '[]'::json),
    'performance', json_build_object('items', COALESCE((SELECT json_agg(p ORDER BY ${options.order}) FROM product_page p), '[]'::json),
      'total', (SELECT total FROM product_page_meta), 'page', (SELECT page FROM product_page_meta), 'limit', ${options.limit},
      'totalPages', (SELECT total_pages FROM product_page_meta), 'sort', ${options.sort}, 'direction', ${options.direction})
  )`;
}
