import { Prisma } from '@prisma/client';
import { customerAnalyticsCTEs, customerAnalyticsJSON, customerPageOptions } from './supplierCustomerAnalytics.sql.js';
import { productAnalyticsCTEs, productAnalyticsJSON, productPageOptions } from './supplierProductAnalytics.sql.js';
import { orderAnalyticsCTEs, orderAnalyticsJSON, orderPageOptions } from './supplierOrderAnalytics.sql.js';
import { feeAnalyticsCTEs, feeAnalyticsJSON, feePageOptions, payoutAnalyticsCTEs, payoutAnalyticsJSON, payoutPageOptions } from './supplierFinanceAnalytics.sql.js';
const DAY = 86400000;
const MANILA_OFFSET = 8 * 60 * 60 * 1000;
export function analyticsRange(startDate, endDate) {
    const parse = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
            throw new Error('Use YYYY-MM-DD analytics dates.');
        const date = new Date(`${value}T00:00:00.000Z`);
        if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value)
            throw new Error('Invalid analytics date.');
        return date.valueOf();
    };
    const first = parse(startDate);
    const last = parse(endDate);
    const days = (last - first) / DAY + 1;
    if (days < 1 || days > 366)
        throw new Error('Choose an ordered analytics range of at most 366 days.');
    const comparisonEnd = new Date(first - DAY).toISOString().slice(0, 10);
    const comparisonStart = new Date(first - days * DAY).toISOString().slice(0, 10);
    return {
        startDate, endDate, comparisonStart, comparisonEnd, days,
        start: new Date(first - MANILA_OFFSET),
        endExclusive: new Date(last + DAY - MANILA_OFFSET),
        previousStart: new Date(first - days * DAY - MANILA_OFFSET),
        interval: days <= 31 ? 'DAILY' : days <= 184 ? 'WEEKLY' : 'MONTHLY',
    };
}
/** One parameterised statement gives all dashboard sections a consistent database snapshot.
 * Only bounded, aggregated data leaves PostgreSQL. No financial writes or wallet reads.
 */
export async function getSupplierAnalytics(prisma, orgId, input) {
    if (!Number.isSafeInteger(orgId) || orgId <= 0)
        throw new Error('Supplier organization is required.');
    const range = analyticsRange(input.startDate, input.endDate);
    const productOptions = productPageOptions(input);
    const customerOptions = customerPageOptions(input);
    const orderOptions = orderPageOptions(input);
    const feeOptions = feePageOptions(input);
    const payoutOptions = payoutPageOptions(input);
    const search = input.search?.trim() ?? '';
    if (search.length > 100)
        throw new Error('Analytics search must be at most 100 characters.');
    const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
    const unit = range.interval === 'DAILY' ? 'day' : range.interval === 'WEEKLY' ? 'week' : 'month';
    const step = range.interval === 'DAILY' ? '1 day' : range.interval === 'WEEKLY' ? '1 week' : '1 month';
    // Search is a literal substring, including user-entered %, _ and backslashes.
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const rows = await prisma.$queryRaw(Prisma.sql `
    WITH scope AS (
      SELECT p.*, COALESCE(NULLIF(b.name, ''), NULLIF(a.fullname, ''),
        CASE WHEN p."agentId" IS NOT NULL THEN 'Agent Buyer' ELSE 'Buyer' END) AS buyer_name,
        CASE WHEN p."buyerOrgId" IS NOT NULL THEN 'ORGANIZATION'
          WHEN p."agentId" IS NOT NULL THEN 'AGENT' END AS buyer_type,
        CASE WHEN p."buyerOrgId" IS NOT NULL THEN 'org:' || p."buyerOrgId"::text
          WHEN p."agentId" IS NOT NULL THEN 'agent:' || p."agentId" END AS buyer_key
      FROM "PurchaseOrder" p
      JOIN "Organization" supplier ON supplier.id = p."supplierOrgId"
      LEFT JOIN "Organization" b ON b.id = p."buyerOrgId"
      LEFT JOIN "Agent" a ON a.id = p."agentId"
      WHERE p."supplierOrgId" = ${orgId}
        AND (p."createdAt" >= ${range.previousStart} AND p."createdAt" < ${range.endExclusive}
          OR EXISTS (SELECT 1 FROM "PurchaseOrderSettlement" activity WHERE activity."purchaseOrderId" = p.id
            AND activity."supplierOrgId" = ${orgId} AND activity.environment::text = ${environment}
            AND activity."settledAt" >= ${range.previousStart} AND activity."settledAt" < ${range.endExclusive}))
        AND (${search} = '' OR p."poNumber" ILIKE ${pattern}
          OR b.name ILIKE ${pattern} OR a.fullname ILIKE ${pattern}
          OR EXISTS (SELECT 1 FROM "POLineItem" l JOIN "SupplierItem" i ON i.id = l."supplierItemId"
            WHERE l."poId" = p.id AND COALESCE(l."itemName", i.name) ILIKE ${pattern}))
    ), settled AS (
      SELECT s.*, p.buyer_name, p.buyer_key, p.buyer_type, p."poNumber", p.status::text AS po_status
      FROM "PurchaseOrderSettlement" s JOIN scope p ON p.id = s."purchaseOrderId"
      WHERE s."supplierOrgId" = ${orgId} AND s.environment::text = ${environment}
        AND s.status::text = 'SETTLED' AND s."settledAt" >= ${range.previousStart}
        AND s."settledAt" < ${range.endExclusive}
    ), current_sales AS (
      SELECT * FROM settled WHERE "settledAt" >= ${range.start}
    ), operational AS (
      SELECT p.* FROM scope p WHERE p."createdAt" >= ${range.previousStart} AND p."createdAt" < ${range.endExclusive}
        AND COALESCE(
          (SELECT s.environment::text FROM "PurchaseOrderSettlement" s WHERE s."purchaseOrderId" = p.id AND s."supplierOrgId" = ${orgId}),
          (SELECT t.environment::text FROM "PaymentTransaction" t WHERE t."relatedId" = p.id
            AND t."relatedType"::text = 'PURCHASE_ORDER' AND t."supplierOrgId" = ${orgId}
            ORDER BY t."createdAt" DESC, t.id DESC LIMIT 1),
          (SELECT a.environment::text FROM "Agent" a WHERE a.id = p."agentId"),
          (SELECT CASE WHEN o."isDevSeed" THEN 'SANDBOX' ELSE 'PRODUCTION' END FROM "Organization" o WHERE o.id = ${orgId})
        ) = ${environment}
    ), periods AS (
      SELECT 'current' AS key, ${range.start}::timestamp AS first, ${range.endExclusive}::timestamp AS last
      UNION ALL SELECT 'previous', ${range.previousStart}::timestamp, ${range.start}::timestamp
    ), metrics AS (
      SELECT r.key, json_build_object(
        'grossSales', COALESCE(sum(s."grossAmount"::numeric), 0),
        'netEarnings', COALESCE(sum(s."supplierNet"::numeric), 0),
        'platformFees', COALESCE(sum(s."platformFee"::numeric), 0),
        'settledOrders', count(s.id),
        'customers', count(DISTINCT s.buyer_key),
        'totalOrders', (SELECT count(*) FROM operational p WHERE p."createdAt" >= r.first AND p."createdAt" < r.last),
        'productsSold', (SELECT COALESCE(sum(l.qty), 0) FROM "POLineItem" l JOIN settled ss ON ss."purchaseOrderId" = l."poId"
          WHERE ss."settledAt" >= r.first AND ss."settledAt" < r.last)
      ) AS value FROM periods r LEFT JOIN settled s ON s."settledAt" >= r.first AND s."settledAt" < r.last GROUP BY r.key, r.first, r.last
    ), buckets AS (
      SELECT generate_series(date_trunc(${unit}, ${input.startDate}::date), date_trunc(${unit}, ${input.endDate}::date), ${step}::interval) AS bucket
    ), trend AS (
      SELECT b.bucket, COALESCE(sum(s."grossAmount"::numeric), 0) AS gross,
        COALESCE(sum(s."supplierNet"::numeric), 0) AS net, COALESCE(sum(s."platformFee"::numeric), 0) AS fees,
        count(s.id) AS settled_orders
      FROM buckets b LEFT JOIN current_sales s ON date_trunc(${unit}, s."settledAt" + interval '8 hours') = b.bucket GROUP BY b.bucket
    ), sold_lines AS (
      SELECT l.*, COALESCE(NULLIF(l."itemName", ''), i.name) AS product_name,
        COALESCE('global:' || c.id, 'legacy:' || lc.id, 'uncategorised') AS category_key,
        COALESCE(c.name, lc.name, 'Uncategorised') AS category_name
      FROM "POLineItem" l JOIN current_sales s ON s."purchaseOrderId" = l."poId"
      JOIN "SupplierItem" i ON i.id = l."supplierItemId"
      LEFT JOIN "Category" c ON c.id = i."globalCategoryId"
      LEFT JOIN "SupplierItemCategory" lc ON lc.id = i."categoryId"
    ), categories AS (
      SELECT category_key, category_name, sum(subtotal::numeric) AS amount,
        row_number() OVER (ORDER BY sum(subtotal::numeric) DESC, category_key) AS rank
      FROM sold_lines GROUP BY category_key, category_name
    ), category_groups AS (
      SELECT CASE WHEN rank <= 5 THEN category_key ELSE 'others' END AS key,
        CASE WHEN rank <= 5 THEN category_name ELSE 'Others' END AS name, sum(amount) AS amount
      FROM categories GROUP BY 1, 2
    ), statuses AS (
      SELECT CASE WHEN status::text = 'COMPLETED' THEN 'Completed'
        WHEN status::text = 'DELIVERED' THEN 'Delivered'
        WHEN status::text IN ('CANCELLED', 'REJECTED') THEN 'Cancelled / Rejected'
        ELSE 'In Progress' END AS label, count(*) AS count
      FROM operational WHERE "createdAt" >= ${range.start} GROUP BY 1
    ), products AS (
      SELECT "supplierItemId" AS id, (array_agg(product_name ORDER BY id DESC))[1] AS name, sum(qty) AS quantity
      FROM sold_lines GROUP BY "supplierItemId" ORDER BY quantity DESC, "supplierItemId" LIMIT 5
    ), buyers AS (
      SELECT buyer_key AS key, max(buyer_name) AS name, sum("grossAmount"::numeric) AS amount, count(*) AS count
      FROM current_sales WHERE buyer_key IS NOT NULL GROUP BY buyer_key ORDER BY amount DESC, buyer_key LIMIT 5
    ), recent AS (
      SELECT s.*, (SELECT count(*) FROM "POLineItem" l WHERE l."poId" = s."purchaseOrderId") AS item_count
      FROM current_sales s ORDER BY s."settledAt" DESC, s.id DESC LIMIT 5
    ), ${productAnalyticsCTEs(orgId, range.start, unit, productOptions)},
    ${customerAnalyticsCTEs(orgId, environment, search, pattern, range.start, unit, customerOptions)},
    ${orderAnalyticsCTEs(orgId, environment, search, pattern, unit, orderOptions)},
    ${feeAnalyticsCTEs(unit, feeOptions)},
    ${payoutAnalyticsCTEs(orgId, environment, search, pattern, unit, payoutOptions)}
    SELECT json_build_object(
      'productAnalytics', ${productAnalyticsJSON(productOptions)},
      'customerAnalytics', ${customerAnalyticsJSON(customerOptions)},
      'orderAnalytics', ${orderAnalyticsJSON(orderOptions)},
      'feeAnalytics', ${feeAnalyticsJSON(feeOptions)},
      'payoutAnalytics', ${payoutAnalyticsJSON(payoutOptions)},
      'supplierName', COALESCE((SELECT name FROM "Organization" WHERE id = ${orgId}), 'Supplier'),
      'kpis', (SELECT value FROM metrics WHERE key = 'current'),
      'previousKpis', (SELECT value FROM metrics WHERE key = 'previous'),
      'revenueTrend', COALESCE((SELECT json_agg(json_build_object('bucket', to_char(bucket, 'YYYY-MM-DD'), 'grossSales', gross, 'netEarnings', net, 'platformFees', fees, 'settledOrders', settled_orders) ORDER BY bucket) FROM trend), '[]'::json),
      'categorySales', COALESCE((SELECT json_agg(json_build_object('key', key, 'name', name, 'amount', amount, 'percentage', COALESCE(100 * amount / NULLIF((SELECT sum(amount) FROM category_groups), 0), 0)) ORDER BY amount DESC, key) FROM category_groups), '[]'::json),
      'orderStatuses', COALESCE((SELECT json_agg(json_build_object('label', label, 'count', count, 'percentage', 100.0 * count / NULLIF((SELECT sum(count) FROM statuses), 0)) ORDER BY count DESC, label) FROM statuses), '[]'::json),
      'topProducts', COALESCE((SELECT json_agg(json_build_object('id', id, 'name', name, 'quantity', quantity) ORDER BY quantity DESC, id) FROM products), '[]'::json),
      'topCustomers', COALESCE((SELECT json_agg(json_build_object('key', key, 'name', name, 'amount', amount, 'orderCount', count) ORDER BY amount DESC, key) FROM buyers), '[]'::json),
      'recentOrders', COALESCE((SELECT json_agg(json_build_object('id', "purchaseOrderId", 'poNumber', "poNumber", 'buyerName', buyer_name, 'itemCount', item_count,
        'grossAmount', "grossAmount", 'platformFee', "platformFee", 'netAmount', "supplierNet", 'status', po_status, 'date', to_char("settledAt" + interval '8 hours', 'YYYY-MM-DD')) ORDER BY "settledAt" DESC, id DESC) FROM recent), '[]'::json)
    ) AS data
  `);
    return { ...rows[0].data, range: { startDate: input.startDate, endDate: input.endDate },
        comparisonRange: { startDate: range.comparisonStart, endDate: range.comparisonEnd },
        interval: range.interval, environment, search };
}
