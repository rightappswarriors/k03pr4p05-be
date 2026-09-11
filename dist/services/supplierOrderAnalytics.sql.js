import { Prisma } from '@prisma/client';
export function orderPageOptions(input) {
    const page = input.orderPage ?? 1;
    const limit = input.orderLimit ?? 20;
    const sort = input.orderSort ?? 'CREATED';
    const direction = input.orderDirection ?? 'DESC';
    const columns = {
        CREATED: '"createdAt"', COMPLETED: '"completedAt"', FULFILLMENT: '"fulfillmentHours"', STATUS: 'status', AMOUNT: '"totalAmount"',
    };
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
        throw new Error('Invalid order page.');
    if (![20, 50, 100].includes(limit))
        throw new Error('Invalid order page size.');
    if (!Object.prototype.hasOwnProperty.call(columns, sort) || !['ASC', 'DESC'].includes(direction))
        throw new Error('Invalid order sort.');
    return { page, limit, sort, direction, order: Prisma.raw(`${columns[sort]} ${direction} NULLS LAST, id COLLATE "C" ASC`) };
}
/** Uses only persisted PO/Delivery timestamps. buyerConfirmedAt is the completion
 * timestamp: the marketplace receipt-confirmation action transitions DELIVERED to COMPLETED
 * and writes it in the same update. The current portal does not persist a PO completedAt.
 */
export function orderAnalyticsCTEs(orgId, environment, search, pattern, unit, options) {
    return Prisma.sql `
  operational_all AS (
    SELECT p.*, d."deliveredAt",
      COALESCE(NULLIF(b.name, ''), NULLIF(a.fullname, ''),
        CASE WHEN p."agentId" IS NOT NULL THEN 'Agent Buyer' ELSE 'Buyer' END) AS buyer_name,
      COALESCE(d.status::text, 'NOT_SCHEDULED') AS delivery_status
    FROM "PurchaseOrder" p
    LEFT JOIN "Organization" b ON b.id = p."buyerOrgId"
    LEFT JOIN "Agent" a ON a.id = p."agentId"
    LEFT JOIN "Delivery" d ON d."poId" = p.id
    WHERE p."supplierOrgId" = ${orgId}
      AND COALESCE(
        (SELECT s.environment::text FROM "PurchaseOrderSettlement" s WHERE s."purchaseOrderId" = p.id AND s."supplierOrgId" = ${orgId}),
        (SELECT t.environment::text FROM "PaymentTransaction" t WHERE t."relatedId" = p.id
          AND t."relatedType"::text = 'PURCHASE_ORDER' AND t."supplierOrgId" = ${orgId}
          ORDER BY t."createdAt" DESC, t.id DESC LIMIT 1),
        (SELECT agent.environment::text FROM "Agent" agent WHERE agent.id = p."agentId"),
        (SELECT CASE WHEN o."isDevSeed" THEN 'SANDBOX' ELSE 'PRODUCTION' END FROM "Organization" o WHERE o.id = ${orgId})
      ) = ${environment}
      AND (${search} = '' OR p."poNumber" ILIKE ${pattern} OR b.name ILIKE ${pattern} OR a.fullname ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM "POLineItem" l LEFT JOIN "SupplierItem" i ON i.id = l."supplierItemId"
          WHERE l."poId" = p.id AND COALESCE(NULLIF(l."itemName", ''), i.name) ILIKE ${pattern}))
  ), order_activity AS (
    SELECT p.*, CASE WHEN p."createdAt" >= (SELECT first FROM periods WHERE key = 'current') THEN 'current' ELSE 'previous' END AS period
    FROM operational_all p
    WHERE p."createdAt" >= (SELECT first FROM periods WHERE key = 'previous')
      AND p."createdAt" < (SELECT last FROM periods WHERE key = 'current')
  ), order_metrics AS (
    SELECT period, json_build_object(
      'totalOrders', count(*),
      'completedOrders', count(*) FILTER (WHERE status::text = 'COMPLETED'),
      'inProgressOrders', count(*) FILTER (WHERE status::text NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')),
      'cancelledRejected', count(*) FILTER (WHERE status::text IN ('CANCELLED', 'REJECTED')),
      'completionRate', 100.0 * count(*) FILTER (WHERE status::text = 'COMPLETED') / NULLIF(count(*), 0),
      'averageFulfillmentHours', avg(EXTRACT(epoch FROM ("buyerConfirmedAt" - "supplierConfirmedAt")) / 3600.0)
        FILTER (WHERE status::text = 'COMPLETED' AND "supplierConfirmedAt" IS NOT NULL AND "buyerConfirmedAt" >= "supplierConfirmedAt"),
      'invalidDurationCount', count(*) FILTER (WHERE status::text = 'COMPLETED' AND "supplierConfirmedAt" IS NOT NULL
        AND "buyerConfirmedAt" IS NOT NULL AND "buyerConfirmedAt" < "supplierConfirmedAt")
    ) AS value
    FROM order_activity GROUP BY period
  ), order_volume AS (
    SELECT b.bucket, count(DISTINCT c.id) AS created, count(DISTINCT completed.id) AS completed
    FROM buckets b
    LEFT JOIN order_activity c ON c.period = 'current' AND date_trunc(${unit}, c."createdAt" + interval '8 hours') = b.bucket
    LEFT JOIN operational_all completed ON completed.status::text = 'COMPLETED' AND completed."buyerConfirmedAt" IS NOT NULL
      AND completed."buyerConfirmedAt" >= (SELECT first FROM periods WHERE key = 'current')
      AND completed."buyerConfirmedAt" < (SELECT last FROM periods WHERE key = 'current')
      AND date_trunc(${unit}, completed."buyerConfirmedAt" + interval '8 hours') = b.bucket
    GROUP BY b.bucket
  ), order_status_distribution AS (
    SELECT CASE
      WHEN status::text = 'PENDING' THEN 'Awaiting Supplier'
      WHEN status::text IN ('SUPPLIER_ACCEPTED', 'ACCEPTED') THEN 'Accepted'
      WHEN status::text = 'PREPARING' THEN 'Preparing'
      WHEN status::text = 'READY_FOR_DISPATCH' THEN 'Ready for Dispatch'
      WHEN status::text = 'IN_TRANSIT' THEN 'In Transit'
      WHEN status::text = 'DELIVERED' THEN 'Delivered'
      WHEN status::text = 'COMPLETED' THEN 'Completed'
      WHEN status::text IN ('CANCELLED', 'REJECTED') THEN 'Cancelled / Rejected'
      ELSE status::text END AS label, count(*) AS count
    FROM order_activity WHERE period = 'current' GROUP BY 1
  ), order_stage_durations AS (
    SELECT 'Supplier Accepted → Preparing' AS stage, avg(EXTRACT(epoch FROM ("preparingAt" - "supplierConfirmedAt")) / 3600.0) AS "averageHours", count(*) AS "sampleCount"
      FROM order_activity WHERE period = 'current' AND "supplierConfirmedAt" IS NOT NULL AND "preparingAt" >= "supplierConfirmedAt"
    UNION ALL SELECT 'Preparing → Ready for Dispatch', avg(EXTRACT(epoch FROM ("readyForDispatchAt" - "preparingAt")) / 3600.0), count(*)
      FROM order_activity WHERE period = 'current' AND "preparingAt" IS NOT NULL AND "readyForDispatchAt" >= "preparingAt"
    UNION ALL SELECT 'Ready for Dispatch → In Transit', avg(EXTRACT(epoch FROM ("dispatchedAt" - "readyForDispatchAt")) / 3600.0), count(*)
      FROM order_activity WHERE period = 'current' AND "readyForDispatchAt" IS NOT NULL AND "dispatchedAt" >= "readyForDispatchAt"
    UNION ALL SELECT 'In Transit → Delivered', avg(EXTRACT(epoch FROM ("deliveredAt" - "dispatchedAt")) / 3600.0), count(*)
      FROM order_activity WHERE period = 'current' AND "dispatchedAt" IS NOT NULL AND "deliveredAt" >= "dispatchedAt"
    UNION ALL SELECT 'Delivered → Buyer Confirmation', avg(EXTRACT(epoch FROM ("buyerConfirmedAt" - "deliveredAt")) / 3600.0), count(*)
      FROM order_activity WHERE period = 'current' AND "deliveredAt" IS NOT NULL AND "buyerConfirmedAt" >= "deliveredAt"
  ), order_delivery AS (
    SELECT count(*) FILTER (WHERE "deliveredAt" IS NOT NULL) AS delivered,
      count(*) FILTER (WHERE "deliveredAt" IS NOT NULL AND "deliveryDateAgreementStatus"::text = 'AGREED' AND "supplierExpectedDeliveryAt" IS NOT NULL) AS eligible,
      count(*) FILTER (WHERE "deliveredAt" IS NOT NULL AND "deliveryDateAgreementStatus"::text = 'AGREED' AND "supplierExpectedDeliveryAt" IS NOT NULL
        AND ("deliveredAt" + interval '8 hours')::date <= ("supplierExpectedDeliveryAt" + interval '8 hours')::date) AS on_time,
      count(*) FILTER (WHERE "deliveredAt" IS NOT NULL AND "deliveryDateAgreementStatus"::text = 'AGREED' AND "supplierExpectedDeliveryAt" IS NOT NULL
        AND ("deliveredAt" + interval '8 hours')::date > ("supplierExpectedDeliveryAt" + interval '8 hours')::date) AS late,
      avg(GREATEST(0, (("deliveredAt" + interval '8 hours')::date - ("supplierExpectedDeliveryAt" + interval '8 hours')::date)::numeric))
        FILTER (WHERE "deliveredAt" IS NOT NULL AND "deliveryDateAgreementStatus"::text = 'AGREED' AND "supplierExpectedDeliveryAt" IS NOT NULL) AS "averageDelayDays"
    FROM order_activity WHERE period = 'current'
  ), order_backlog AS (
    SELECT CASE
      WHEN status::text = 'PENDING' THEN 'Awaiting Supplier'
      WHEN status::text IN ('SUPPLIER_ACCEPTED', 'ACCEPTED') THEN 'Accepted'
      WHEN status::text = 'PREPARING' THEN 'Preparing'
      WHEN status::text = 'READY_FOR_DISPATCH' THEN 'Ready for Dispatch'
      WHEN status::text = 'IN_TRANSIT' THEN 'In Transit'
      WHEN status::text = 'DELIVERED' THEN 'Delivered awaiting buyer confirmation'
      ELSE status::text END AS status, count(*) AS count
    FROM operational_all WHERE status::text NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED') GROUP BY 1
  ), order_aging AS (
    SELECT CASE WHEN now() - "createdAt" < interval '1 day' THEN '< 1 day'
      WHEN now() - "createdAt" < interval '3 days' THEN '1–3 days'
      WHEN now() - "createdAt" < interval '7 days' THEN '3–7 days' ELSE '7+ days' END AS bucket,
      CASE WHEN now() - "createdAt" < interval '1 day' THEN 1 WHEN now() - "createdAt" < interval '3 days' THEN 2
        WHEN now() - "createdAt" < interval '7 days' THEN 3 ELSE 4 END AS position, count(*) AS count
    FROM operational_all WHERE status::text NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED') GROUP BY 1, 2
  ), order_rows AS (
    SELECT p.id, p."poNumber", p.buyer_name AS "buyerName", p.status::text AS status, p.source::text AS source,
      p."supplierConfirmation"::text AS "supplierConfirmation", p."paymentStatus"::text AS "paymentStatus", p.delivery_status AS "deliveryStatus",
      p."createdAt", p."supplierConfirmedAt", p."buyerConfirmedAt" AS "completedAt", p."totalAmount",
      (SELECT count(*) FROM "POLineItem" l WHERE l."poId" = p.id) AS "itemCount",
      CASE WHEN p."supplierConfirmedAt" IS NOT NULL AND p."buyerConfirmedAt" >= p."supplierConfirmedAt"
        THEN EXTRACT(epoch FROM (p."buyerConfirmedAt" - p."supplierConfirmedAt")) / 3600.0 END AS "fulfillmentHours"
    FROM order_activity p WHERE period = 'current'
  ), order_page_meta AS (
    SELECT count(*) AS total, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int AS total_pages,
      LEAST(${options.page}, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int) AS page FROM order_rows
  ), order_page AS (
    SELECT * FROM order_rows ORDER BY ${options.order} LIMIT ${options.limit}
    OFFSET (SELECT (page - 1) * ${options.limit} FROM order_page_meta)
  )`;
}
export function orderAnalyticsJSON(options) {
    return Prisma.sql `json_build_object(
    'metrics', COALESCE((SELECT value FROM order_metrics WHERE period = 'current'),
      json_build_object('totalOrders', 0, 'completedOrders', 0, 'inProgressOrders', 0, 'cancelledRejected', 0, 'completionRate', NULL, 'averageFulfillmentHours', NULL, 'invalidDurationCount', 0)),
    'previousMetrics', COALESCE((SELECT value FROM order_metrics WHERE period = 'previous'),
      json_build_object('totalOrders', 0, 'completedOrders', 0, 'inProgressOrders', 0, 'cancelledRejected', 0, 'completionRate', NULL, 'averageFulfillmentHours', NULL, 'invalidDurationCount', 0)),
    'volumeTrend', COALESCE((SELECT json_agg(json_build_object('bucket', to_char(bucket, 'YYYY-MM-DD'), 'created', created, 'completed', completed) ORDER BY bucket) FROM order_volume), '[]'::json),
    'statusDistribution', COALESCE((SELECT json_agg(json_build_object('label', label, 'count', count,
      'percentage', 100.0 * count / NULLIF((SELECT sum(count) FROM order_status_distribution), 0)) ORDER BY count DESC, label) FROM order_status_distribution), '[]'::json),
    'stageDurations', COALESCE((SELECT json_agg(s ORDER BY stage) FROM order_stage_durations s WHERE "sampleCount" > 0), '[]'::json),
    'deliveryPerformance', json_build_object('deliveredOrders', (SELECT delivered FROM order_delivery), 'eligibleOrders', (SELECT eligible FROM order_delivery),
      'onTimeOrders', (SELECT on_time FROM order_delivery), 'lateOrders', (SELECT late FROM order_delivery),
      'onTimeRate', 100.0 * (SELECT on_time FROM order_delivery) / NULLIF((SELECT eligible FROM order_delivery), 0),
      'averageDelayDays', (SELECT "averageDelayDays" FROM order_delivery)),
    'backlog', COALESCE((SELECT json_agg(b ORDER BY status) FROM order_backlog b), '[]'::json),
    'aging', COALESCE((SELECT json_agg(json_build_object('bucket', bucket, 'count', count) ORDER BY position) FROM order_aging), '[]'::json),
    'slowestOrders', COALESCE((SELECT json_agg(r ORDER BY "fulfillmentHours" DESC, id COLLATE "C") FROM
      (SELECT * FROM order_rows WHERE status = 'COMPLETED' AND "supplierConfirmedAt" IS NOT NULL AND "completedAt" >= "supplierConfirmedAt"
        ORDER BY "fulfillmentHours" DESC, id COLLATE "C" LIMIT 5) r), '[]'::json),
    'performance', json_build_object('items', COALESCE((SELECT json_agg(p ORDER BY ${options.order}) FROM order_page p), '[]'::json),
      'total', (SELECT total FROM order_page_meta), 'page', (SELECT page FROM order_page_meta), 'limit', ${options.limit},
      'totalPages', (SELECT total_pages FROM order_page_meta), 'sort', ${options.sort}, 'direction', ${options.direction})
  )`;
}
