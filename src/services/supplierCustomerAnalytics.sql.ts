import { Prisma } from '@prisma/client';

export interface CustomerPageInput { customerPage?: number | null; customerLimit?: number | null; customerSort?: string | null; customerDirection?: string | null }

export function customerPageOptions(input: CustomerPageInput) {
  const page = input.customerPage ?? 1;
  const limit = input.customerLimit ?? 20;
  const sort = input.customerSort ?? 'REVENUE';
  const direction = input.customerDirection ?? 'DESC';
  const columns: Record<string, string> = {
    REVENUE: 'revenue', NET: '"netEarnings"', ORDERS: '"settledOrders"', AVERAGE: '"averageOrderValue"',
    CONTRIBUTION: 'contribution', LATEST_PURCHASE: '"latestPurchaseAt"', FIRST_PURCHASE: '"firstPurchaseAt"',
  };
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new Error('Invalid customer page.');
  if (![20, 50, 100].includes(limit)) throw new Error('Invalid customer page size.');
  if (!Object.prototype.hasOwnProperty.call(columns, sort) || !['ASC', 'DESC'].includes(direction)) throw new Error('Invalid customer sort.');
  return { page, limit, sort, direction, order: Prisma.raw(`${columns[sort]} ${direction} NULLS LAST, "customerKey" ASC`) };
}

/** Customer identity is organization-first because organization-linked RFQ agents act for
 * their organization and PO creation records both IDs. Standalone agents have only agentId.
 * Lifetime first purchase is filtered by the same supplier, finance environment, SETTLED
 * status and literal whole-order search as the selected and comparison populations.
 */
export function customerAnalyticsCTEs(
  orgId: number,
  environment: string,
  search: string,
  pattern: string,
  start: Date,
  unit: string,
  options: ReturnType<typeof customerPageOptions>,
) {
  return Prisma.sql`
  customer_history AS (
    SELECT s."settledAt" AS settled_at,
      CASE WHEN p."buyerOrgId" IS NOT NULL THEN 'org:' || p."buyerOrgId"::text
        WHEN p."agentId" IS NOT NULL THEN 'agent:' || p."agentId" END AS customer_key
    FROM "PurchaseOrderSettlement" s
    JOIN "PurchaseOrder" p ON p.id = s."purchaseOrderId"
    LEFT JOIN "Organization" b ON b.id = p."buyerOrgId"
    LEFT JOIN "Agent" a ON a.id = p."agentId"
    WHERE s."supplierOrgId" = ${orgId} AND p."supplierOrgId" = ${orgId}
      AND s.environment::text = ${environment} AND s.status::text = 'SETTLED'
      AND (${search} = '' OR p."poNumber" ILIKE ${pattern} OR b.name ILIKE ${pattern} OR a.fullname ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM "POLineItem" l JOIN "SupplierItem" i ON i.id = l."supplierItemId"
          WHERE l."poId" = p.id AND COALESCE(NULLIF(l."itemName", ''), i.name) ILIKE ${pattern}))
  ), customer_first AS (
    SELECT customer_key, min(settled_at) AS first_at FROM customer_history
    WHERE customer_key IS NOT NULL GROUP BY customer_key
  ), customer_activity AS (
    SELECT s.id AS settlement_id, s."purchaseOrderId" AS po_id, s."settledAt" AS settled_at,
      CASE WHEN s."settledAt" >= ${start} THEN 'current' ELSE 'previous' END AS period,
      s.buyer_key AS customer_key, s.buyer_name AS display_name, s.buyer_type AS customer_type,
      s."grossAmount"::numeric AS gross, s."platformFee"::numeric AS fees, s."supplierNet"::numeric AS net,
      f.first_at
    FROM settled s JOIN customer_first f ON f.customer_key = s.buyer_key
    WHERE s.buyer_key IS NOT NULL
  ), customer_grouped AS (
    SELECT a.period, a.customer_key,
      (array_agg(a.display_name ORDER BY a.settled_at DESC, a.po_id COLLATE "C"))[1] AS display_name,
      (array_agg(a.customer_type ORDER BY a.settled_at DESC, a.po_id COLLATE "C"))[1] AS customer_type,
      min(a.first_at) AS first_at, max(a.settled_at) AS latest_at,
      sum(a.gross) AS revenue, sum(a.fees) AS fees, sum(a.net) AS net, count(DISTINCT a.po_id) AS orders
    FROM customer_activity a GROUP BY a.period, a.customer_key
  ), customer_classified AS (
    SELECT g.*, CASE WHEN g.first_at >= p.first THEN 'NEW' ELSE 'RETURNING' END AS status
    FROM customer_grouped g JOIN periods p ON p.key = g.period
  ), customer_metrics AS (
    SELECT p.key, json_build_object(
      'uniqueCustomers', count(c.customer_key),
      'newCustomers', count(c.customer_key) FILTER (WHERE c.status = 'NEW'),
      'returningCustomers', count(c.customer_key) FILTER (WHERE c.status = 'RETURNING'),
      'revenue', COALESCE(sum(c.revenue), 0),
      'averageOrderValue', sum(c.revenue) / NULLIF(sum(c.orders), 0),
      'repeatCustomerRate', 100.0 * count(c.customer_key) FILTER (WHERE c.status = 'RETURNING') / NULLIF(count(c.customer_key), 0)
    ) AS value FROM periods p LEFT JOIN customer_classified c ON c.period = p.key GROUP BY p.key
  ), customer_rows AS (
    SELECT c.customer_key AS "customerKey", c.display_name AS "displayName", c.customer_type AS "customerType", c.status,
      c.revenue, c.fees, c.net AS "netEarnings", c.orders AS "settledOrders", c.revenue / NULLIF(c.orders, 0) AS "averageOrderValue",
      c.first_at AS "firstPurchaseAt", c.latest_at AS "latestPurchaseAt",
      to_char(c.first_at + interval '8 hours', 'YYYY-MM-DD') AS "firstPurchase",
      to_char(c.latest_at + interval '8 hours', 'YYYY-MM-DD') AS "latestPurchase",
      COALESCE(100 * c.revenue / NULLIF((SELECT sum(revenue) FROM customer_classified WHERE period = 'current'), 0), 0) AS contribution,
      COALESCE(p.revenue, 0) AS "previousRevenue"
    FROM customer_classified c LEFT JOIN customer_classified p ON p.customer_key = c.customer_key AND p.period = 'previous'
    WHERE c.period = 'current'
  ), customer_ranked AS (
    SELECT r.*, row_number() OVER (ORDER BY revenue DESC, "customerKey") AS rank FROM customer_rows r WHERE revenue > 0
  ), customer_contribution AS (
    SELECT CASE WHEN rank <= 5 THEN "customerKey" ELSE 'others' END AS key,
      CASE WHEN rank <= 5 THEN "displayName" ELSE 'Others' END AS name, sum(revenue) AS amount, sum(contribution) AS percentage
    FROM customer_ranked GROUP BY 1, 2
  ), customer_concentration AS (
    SELECT COALESCE(sum(contribution) FILTER (WHERE rank <= 1), 0) AS top1,
      COALESCE(sum(contribution) FILTER (WHERE rank <= 3), 0) AS top3,
      COALESCE(sum(contribution) FILTER (WHERE rank <= 5), 0) AS top5
    FROM customer_ranked
  ), customer_revenue_trend AS (
    SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket, COALESCE(sum(a.gross), 0) AS revenue,
      count(DISTINCT a.customer_key) AS "activeCustomers"
    FROM buckets b LEFT JOIN customer_activity a ON a.period = 'current'
      AND date_trunc(${unit}, a.settled_at + interval '8 hours') = b.bucket GROUP BY b.bucket
  ), customer_lifecycle_trend AS (
    SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
      count(DISTINCT a.customer_key) FILTER (WHERE a.first_at >= ${start}
        AND date_trunc(${unit}, a.first_at + interval '8 hours') = b.bucket) AS "newCustomers",
      count(DISTINCT a.customer_key) FILTER (WHERE a.first_at < ${start}
        OR date_trunc(${unit}, a.first_at + interval '8 hours') <> b.bucket) AS "returningCustomers"
    FROM buckets b LEFT JOIN customer_activity a ON a.period = 'current'
      AND date_trunc(${unit}, a.settled_at + interval '8 hours') = b.bucket GROUP BY b.bucket
  ), customer_diagnostics AS (
    SELECT CASE WHEN s."settledAt" >= ${start} THEN 'current' ELSE 'previous' END AS period,
      count(*) AS "unresolvedSettlements", COALESCE(sum(s."grossAmount"::numeric), 0) AS "unresolvedGross",
      COALESCE(sum(s."platformFee"::numeric), 0) AS "unresolvedFees", COALESCE(sum(s."supplierNet"::numeric), 0) AS "unresolvedNet"
    FROM settled s WHERE s.buyer_key IS NULL GROUP BY 1
  ), customer_page_meta AS (
    SELECT count(*) AS total, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int AS total_pages,
      LEAST(${options.page}, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int) AS page FROM customer_rows
  ), customer_page AS (
    SELECT * FROM customer_rows ORDER BY ${options.order} LIMIT ${options.limit}
    OFFSET (SELECT (page - 1) * ${options.limit} FROM customer_page_meta)
  )`;
}

export function customerAnalyticsJSON(options: ReturnType<typeof customerPageOptions>) {
  return Prisma.sql`json_build_object(
    'metrics', (SELECT value FROM customer_metrics WHERE key = 'current'),
    'previousMetrics', (SELECT value FROM customer_metrics WHERE key = 'previous'),
    'revenueTrend', COALESCE((SELECT json_agg(t ORDER BY bucket) FROM customer_revenue_trend t), '[]'::json),
    'lifecycleTrend', COALESCE((SELECT json_agg(t ORDER BY bucket) FROM customer_lifecycle_trend t), '[]'::json),
    'topCustomers', COALESCE((SELECT json_agg(t ORDER BY revenue DESC, "customerKey") FROM (SELECT * FROM customer_rows ORDER BY revenue DESC, "customerKey" LIMIT 5) t), '[]'::json),
    'contribution', COALESCE((SELECT json_agg(c ORDER BY amount DESC, key) FROM customer_contribution c), '[]'::json),
    'concentration', json_build_object('top1Share', (SELECT top1 FROM customer_concentration), 'top3Share', (SELECT top3 FROM customer_concentration), 'top5Share', (SELECT top5 FROM customer_concentration)),
    'diagnostics', COALESCE((SELECT json_agg(d ORDER BY period) FROM customer_diagnostics d), '[]'::json),
    'performance', json_build_object('items', COALESCE((SELECT json_agg(p ORDER BY ${options.order}) FROM customer_page p), '[]'::json),
      'total', (SELECT total FROM customer_page_meta), 'page', (SELECT page FROM customer_page_meta), 'limit', ${options.limit},
      'totalPages', (SELECT total_pages FROM customer_page_meta), 'sort', ${options.sort}, 'direction', ${options.direction})
  )`;
}
