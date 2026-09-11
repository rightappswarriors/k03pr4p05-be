import { Prisma } from '@prisma/client';

export interface FeePageInput {
  feePage?: number | null;
  feeLimit?: number | null;
  feeSort?: string | null;
  feeDirection?: string | null;
}

export interface PayoutPageInput {
  payoutPage?: number | null;
  payoutLimit?: number | null;
  payoutSort?: string | null;
  payoutDirection?: string | null;
}

function pageOptions(
  page: number,
  limit: number,
  sort: string,
  direction: string,
  columns: Record<string, string>,
  label: string,
  tieBreaker: string,
) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) throw new Error(`Invalid ${label} page.`);
  if (![20, 50, 100].includes(limit)) throw new Error(`Invalid ${label} page size.`);
  if (!Object.prototype.hasOwnProperty.call(columns, sort) || !['ASC', 'DESC'].includes(direction)) throw new Error(`Invalid ${label} sort.`);
  return { page, limit, sort, direction, order: Prisma.raw(`${columns[sort]} ${direction} NULLS LAST, ${tieBreaker}`) };
}

export function feePageOptions(input: FeePageInput) {
  return pageOptions(
    input.feePage ?? 1,
    input.feeLimit ?? 20,
    input.feeSort ?? 'SETTLED',
    input.feeDirection ?? 'DESC',
    { SETTLED: '"settledAt"', GROSS: 'gross', FEE: 'fee', NET: 'net', RATE: '"effectiveRate"' },
    'fee',
    'id COLLATE "C" ASC',
  );
}

export function payoutPageOptions(input: PayoutPageInput) {
  return pageOptions(
    input.payoutPage ?? 1,
    input.payoutLimit ?? 20,
    input.payoutSort ?? 'REQUESTED',
    input.payoutDirection ?? 'DESC',
    { REQUESTED: '"requestedAt"', COMPLETED: '"completedAt"', AMOUNT: 'amount', STATUS: '"analyticsStatus"', PROCESSING: '"processingHours"' },
    'payout',
    'id ASC',
  );
}

/** Fees consume the already supplier/environment/search-scoped settlement CTE.
 * Historical rule metadata is read only from the immutable settlement snapshot.
 */
export function feeAnalyticsCTEs(unit: string, options: ReturnType<typeof feePageOptions>) {
  return Prisma.sql`
  fee_activity AS (
    SELECT s.id, s."purchaseOrderId", s."paymentTransactionId", s."poNumber", s."settledAt",
      s."grossAmount"::numeric AS gross, s."platformFee"::numeric AS fee, s."supplierNet"::numeric AS net,
      s.environment::text AS environment, s.status::text AS status, s."walletPostedAt", s."walletLedgerEntryId",
      s."feeRuleId",
      CASE WHEN jsonb_typeof(s."feeSnapshot"::jsonb #> '{feeRule,rate}') = 'number'
        THEN (s."feeSnapshot"::jsonb #>> '{feeRule,rate}')::numeric END AS "snapshotRate",
      NULLIF(s."feeSnapshot"::jsonb #>> '{feeRule,rateType}', '') AS "snapshotRateType",
      NULLIF(s."feeSnapshot"::jsonb #>> '{feeRule,category}', '') AS "snapshotCategory",
      NULLIF(s."feeSnapshot"::jsonb #>> '{feeRule,unitType}', '') AS "snapshotUnitType",
      CASE WHEN s."settledAt" >= (SELECT first FROM periods WHERE key = 'current') THEN 'current' ELSE 'previous' END AS period
    FROM settled s
  ), fee_metrics AS (
    SELECT p.key AS period, json_build_object(
      'platformFees', COALESCE(sum(f.fee), 0),
      'grossSettled', COALESCE(sum(f.gross), 0),
      'netEarnings', COALESCE(sum(f.net), 0),
      'effectiveFeeRate', 100 * sum(f.fee) / NULLIF(sum(f.gross), 0),
      'averageFee', sum(f.fee) / NULLIF(count(f.id), 0),
      'settlementsWithFees', count(f.id) FILTER (WHERE f.fee > 0),
      'settlementCount', count(f.id)
    ) AS value
    FROM periods p LEFT JOIN fee_activity f ON f."settledAt" >= p.first AND f."settledAt" < p.last
    GROUP BY p.key
  ), fee_trend AS (
    SELECT b.bucket, COALESCE(sum(f.gross), 0) AS gross, COALESCE(sum(f.fee), 0) AS fee,
      COALESCE(sum(f.net), 0) AS net, count(f.id) AS settlements,
      100 * sum(f.fee) / NULLIF(sum(f.gross), 0) AS rate
    FROM buckets b LEFT JOIN fee_activity f ON f.period = 'current'
      AND date_trunc(${unit}, f."settledAt" + interval '8 hours') = b.bucket
    GROUP BY b.bucket
  ), fee_composition_raw AS (
    SELECT COALESCE("snapshotRateType", 'UNAVAILABLE') AS key,
      CASE COALESCE("snapshotRateType", 'UNAVAILABLE')
        WHEN 'PERCENTAGE' THEN 'Percentage' WHEN 'FLAT' THEN 'Flat'
        WHEN 'PER_UNIT' THEN 'Per unit' ELSE 'Historical rule unavailable' END AS label,
      count(*) AS settlements, sum(fee) AS fee
    FROM fee_activity WHERE period = 'current' GROUP BY 1, 2
  ), fee_rows AS (
    SELECT id, "purchaseOrderId" AS "poId", "poNumber", "settledAt", gross, fee, net,
      100 * fee / NULLIF(gross, 0) AS "effectiveRate", "feeRuleId", "snapshotRate", "snapshotRateType",
      "snapshotCategory", "snapshotUnitType", environment,
      CASE WHEN "walletPostedAt" IS NOT NULL AND "walletLedgerEntryId" IS NOT NULL
        THEN 'WALLET_POSTED' ELSE 'SETTLEMENT_RECORDED' END AS "postingState"
    FROM fee_activity WHERE period = 'current'
  ), fee_page_meta AS (
    SELECT count(*) AS total, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int AS total_pages,
      LEAST(${options.page}, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int) AS page FROM fee_rows
  ), fee_page AS (
    SELECT * FROM fee_rows ORDER BY ${options.order} LIMIT ${options.limit}
    OFFSET (SELECT (page - 1) * ${options.limit} FROM fee_page_meta)
  )`;
}

export function feeAnalyticsJSON(options: ReturnType<typeof feePageOptions>) {
  return Prisma.sql`json_build_object(
    'metrics', (SELECT value FROM fee_metrics WHERE period = 'current'),
    'previousMetrics', (SELECT value FROM fee_metrics WHERE period = 'previous'),
    'trend', COALESCE((SELECT json_agg(json_build_object('bucket', to_char(bucket, 'YYYY-MM-DD'),
      'grossSettled', gross, 'platformFees', fee, 'netEarnings', net, 'effectiveFeeRate', rate,
      'settlementCount', settlements) ORDER BY bucket) FROM fee_trend), '[]'::json),
    'composition', COALESCE((SELECT json_agg(json_build_object('key', key, 'label', label, 'settlementCount', settlements,
      'platformFees', fee, 'percentage', COALESCE(100 * fee / NULLIF((SELECT sum(fee) FROM fee_composition_raw), 0), 0))
      ORDER BY fee DESC, key) FROM fee_composition_raw), '[]'::json),
    'highestFeeSettlements', COALESCE((SELECT json_agg(r ORDER BY fee DESC, id COLLATE "C") FROM
      (SELECT * FROM fee_rows ORDER BY fee DESC, id COLLATE "C" LIMIT 5) r), '[]'::json),
    'history', json_build_object('items', COALESCE((SELECT json_agg(p ORDER BY ${options.order}) FROM fee_page p), '[]'::json),
      'total', (SELECT total FROM fee_page_meta), 'page', (SELECT page FROM fee_page_meta), 'limit', ${options.limit},
      'totalPages', (SELECT total_pages FROM fee_page_meta), 'sort', ${options.sort}, 'direction', ${options.direction})
  )`;
}

/** Withdrawal is the only monetary payout population. Attempts are collapsed to
 * one evidence row per withdrawal before joining, so retries cannot multiply money.
 */
export function payoutAnalyticsCTEs(
  orgId: number,
  environment: string,
  search: string,
  pattern: string,
  unit: string,
  options: ReturnType<typeof payoutPageOptions>,
) {
  return Prisma.sql`
  payout_candidates AS (
    SELECT w.*, wallet."orgId" AS "supplierOrgId"
    FROM "Withdrawal" w JOIN "Wallet" wallet ON wallet.id = w."walletId"
    WHERE wallet."orgId" = ${orgId} AND wallet.environment::text = ${environment}
      AND w.environment::text = ${environment} AND wallet."deletedAt" IS NULL AND w."deletedAt" IS NULL
      AND (w."requestedAt" >= (SELECT first FROM periods WHERE key = 'previous')
        AND w."requestedAt" < (SELECT last FROM periods WHERE key = 'current')
        OR w."completedAt" >= (SELECT first FROM periods WHERE key = 'previous')
        AND w."completedAt" < (SELECT last FROM periods WHERE key = 'current')
        OR w."approvedAt" >= (SELECT first FROM periods WHERE key = 'previous')
        AND w."approvedAt" < (SELECT last FROM periods WHERE key = 'current')
        OR EXISTS (SELECT 1 FROM "WithdrawalPayoutAttempt" a WHERE a."withdrawalId" = w.id
          AND a."updatedAt" >= (SELECT first FROM periods WHERE key = 'previous')
          AND a."updatedAt" < (SELECT last FROM periods WHERE key = 'current'))
        OR EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."recordType" = 'Withdrawal' AND a."recordId" = w.id::text
          AND a."createdAt" >= (SELECT first FROM periods WHERE key = 'previous')
          AND a."createdAt" < (SELECT last FROM periods WHERE key = 'current')))
  ), payout_attempt_ranked AS (
    SELECT a.*, row_number() OVER (PARTITION BY a."withdrawalId" ORDER BY a."updatedAt" DESC, a.id COLLATE "C" DESC) AS rank
    FROM "WithdrawalPayoutAttempt" a JOIN payout_candidates w ON w.id = a."withdrawalId"
  ), payout_attempts AS (
    SELECT w.id AS "withdrawalId", count(a.id) AS "attemptCount",
      max(a.status::text) FILTER (WHERE a.rank = 1) AS "latestAttemptStatus",
      max(a.provider) FILTER (WHERE a.rank = 1) AS provider,
      max(a."providerReference") FILTER (WHERE a.rank = 1) AS "providerReference",
      max(a."completedAt") FILTER (WHERE a.rank = 1) AS "attemptCompletedAt",
      max(a."updatedAt") FILTER (WHERE a.rank = 1) AS "attemptUpdatedAt",
      COALESCE(bool_or(a.environment::text <> w.environment::text), false) AS "environmentMismatch",
      COALESCE(bool_or(abs(a.amount::numeric - w.amount::numeric) > 0.009), false) AS "amountMismatch"
    FROM payout_candidates w LEFT JOIN payout_attempt_ranked a ON a."withdrawalId" = w.id
    GROUP BY w.id
  ), payout_audits AS (
    SELECT w.id AS "withdrawalId",
      max(a."createdAt") FILTER (WHERE a."newValue"::jsonb ->> 'action' = 'PAYOUT_COMPLETED') AS "completionAuditAt",
      max(a."createdAt") FILTER (WHERE a."newValue"::jsonb ->> 'action' = 'PAYOUT_FAILED') AS "failureAuditAt",
      max(a."createdAt") FILTER (WHERE a."newValue"::jsonb ->> 'action' = 'WITHDRAWAL_REJECTED') AS "rejectionAuditAt",
      COALESCE(bool_or(a."newValue"::jsonb ->> 'action' = 'LEGACY_PAYOUT_RECONCILIATION_ACKNOWLEDGED'), false) AS "legacyAcknowledged"
    FROM payout_candidates w LEFT JOIN "AuditLog" a ON a."recordType" = 'Withdrawal' AND a."recordId" = w.id::text
      AND a."deletedAt" IS NULL GROUP BY w.id
  ), payout_ledger AS (
    SELECT w.id AS "withdrawalId",
      count(l.id) FILTER (WHERE l."referenceId" = 'withdrawal-payout:' || w.id::text) AS "completionRows",
      max(l.status::text) FILTER (WHERE l."referenceId" = 'withdrawal-payout:' || w.id::text) AS "completionLedgerStatus",
      max(l.amount::numeric) FILTER (WHERE l."referenceId" = 'withdrawal-payout:' || w.id::text) AS "completionLedgerAmount"
    FROM payout_candidates w LEFT JOIN "WalletLedgerEntry" l ON l."walletId" = w."walletId"
      AND l."sourceType"::text = 'WITHDRAWAL' AND l."deletedAt" IS NULL
      AND l."referenceId" = 'withdrawal-payout:' || w.id::text GROUP BY w.id
  ), payout_evidence_raw AS (
    SELECT w.*, a."attemptCount", a."latestAttemptStatus", a.provider, a."providerReference",
      a."attemptCompletedAt", a."attemptUpdatedAt", a."environmentMismatch", a."amountMismatch",
      au."completionAuditAt", au."failureAuditAt", au."rejectionAuditAt", au."legacyAcknowledged",
      l."completionRows", l."completionLedgerStatus", l."completionLedgerAmount",
      (w.status::text = 'COMPLETED' AND a."attemptCount" = 0 AND w.environment::text = 'SANDBOX'
        AND w."completedAt" IS NOT NULL AND au."completionAuditAt" IS NOT NULL AND au."legacyAcknowledged" AND l."completionRows" = 1
        AND l."completionLedgerStatus" IN ('AVAILABLE', 'RELEASED') AND abs(COALESCE(l."completionLedgerAmount", 0) + w.amount::numeric) <= 0.009) AS "legacyNoAttempt",
      (w.status::text = 'COMPLETED' AND w."completedAt" IS NOT NULL AND NOT a."environmentMismatch" AND NOT a."amountMismatch"
        AND ((a."attemptCount" > 0 AND a."latestAttemptStatus" = 'SUCCEEDED')
          OR (a."attemptCount" = 0 AND w.environment::text = 'SANDBOX' AND au."completionAuditAt" IS NOT NULL AND au."legacyAcknowledged"
            AND l."completionRows" = 1 AND l."completionLedgerStatus" IN ('AVAILABLE', 'RELEASED')
            AND abs(COALESCE(l."completionLedgerAmount", 0) + w.amount::numeric) <= 0.009))) AS "authoritativeCompleted",
      (w.status::text = 'COMPLETED' AND w."completedAt" IS NOT NULL AND w."completedAt" < w."requestedAt") AS "invalidDuration",
      COALESCE((a."latestAttemptStatus" = 'RECONCILIATION_REQUIRED' OR a."environmentMismatch" OR a."amountMismatch"
        OR (w.status::text = 'COMPLETED' AND NOT (w."completedAt" IS NOT NULL AND ((a."attemptCount" > 0 AND a."latestAttemptStatus" = 'SUCCEEDED')
          OR (a."attemptCount" = 0 AND w.environment::text = 'SANDBOX' AND au."completionAuditAt" IS NOT NULL AND au."legacyAcknowledged"
            AND l."completionRows" = 1 AND l."completionLedgerStatus" IN ('AVAILABLE', 'RELEASED')
            AND abs(COALESCE(l."completionLedgerAmount", 0) + w.amount::numeric) <= 0.009))))
        OR (w.status::text <> 'COMPLETED' AND a."latestAttemptStatus" = 'SUCCEEDED')), false) AS "requiresReconciliation"
    FROM payout_candidates w JOIN payout_attempts a ON a."withdrawalId" = w.id
    JOIN payout_audits au ON au."withdrawalId" = w.id JOIN payout_ledger l ON l."withdrawalId" = w.id
  ), payout_evidence AS (
    SELECT r.*,
      CASE WHEN "requiresReconciliation" THEN 'RECONCILIATION_REQUIRED'
        WHEN status::text = 'PENDING' THEN 'PENDING' WHEN status::text = 'APPROVED' THEN 'APPROVED'
        WHEN status::text = 'PROCESSING' THEN 'PROCESSING' WHEN status::text = 'COMPLETED' AND "authoritativeCompleted" THEN 'COMPLETED'
        WHEN status::text = 'FAILED' THEN 'FAILED' WHEN status::text = 'REJECTED' THEN 'REJECTED'
        WHEN status::text = 'CANCELLED' THEN 'CANCELLED' ELSE 'RECONCILIATION_REQUIRED' END AS "analyticsStatus",
      CASE WHEN status::text = 'COMPLETED' AND "authoritativeCompleted" THEN "completedAt"
        WHEN status::text = 'FAILED' THEN COALESCE("attemptCompletedAt", "failureAuditAt")
        WHEN status::text = 'REJECTED' THEN COALESCE("rejectionAuditAt", "approvedAt") END AS "terminalAt"
    FROM payout_evidence_raw r
  ), payout_filtered AS (
    SELECT * FROM payout_evidence p WHERE ${search} = ''
      OR ('WD-' || lpad(p.id::text, 6, '0')) ILIKE ${pattern} OR p.id::text ILIKE ${pattern}
      OR p."sandboxReference" ILIKE ${pattern} OR p."payoutMethodTypeSnapshot"::text ILIKE ${pattern}
      OR p."payoutDestinationBank" ILIKE ${pattern} OR p.provider ILIKE ${pattern} OR p."providerReference" ILIKE ${pattern}
  ), payout_metrics AS (
    SELECT period.key AS period, json_build_object(
      'requestedCount', (SELECT count(*) FROM payout_filtered p WHERE p."requestedAt" >= period.first AND p."requestedAt" < period.last),
      'requestedAmount', COALESCE((SELECT sum(p.amount::numeric) FROM payout_filtered p WHERE p."requestedAt" >= period.first AND p."requestedAt" < period.last), 0),
      'completedCount', (SELECT count(*) FROM payout_filtered p WHERE p."analyticsStatus" = 'COMPLETED' AND p."completedAt" >= period.first AND p."completedAt" < period.last),
      'paidOutAmount', COALESCE((SELECT sum(p.amount::numeric) FROM payout_filtered p WHERE p."analyticsStatus" = 'COMPLETED' AND p."completedAt" >= period.first AND p."completedAt" < period.last), 0),
      'processingPendingCount', (SELECT count(*) FROM payout_filtered p WHERE p."requestedAt" >= period.first AND p."requestedAt" < period.last AND p."analyticsStatus" IN ('PENDING', 'APPROVED', 'PROCESSING')),
      'failedRejectedCount', (SELECT count(*) FROM payout_filtered p WHERE p."analyticsStatus" IN ('FAILED', 'REJECTED') AND p."terminalAt" >= period.first AND p."terminalAt" < period.last),
      'successRate', 100.0 * (SELECT count(*) FROM payout_filtered p WHERE p."analyticsStatus" = 'COMPLETED' AND p."completedAt" >= period.first AND p."completedAt" < period.last)
        / NULLIF((SELECT count(*) FROM payout_filtered p WHERE (p."analyticsStatus" = 'COMPLETED' AND p."completedAt" >= period.first AND p."completedAt" < period.last)
          OR (p."analyticsStatus" IN ('FAILED', 'REJECTED') AND p."terminalAt" >= period.first AND p."terminalAt" < period.last)), 0),
      'averageProcessingHours', (SELECT avg(EXTRACT(epoch FROM (p."completedAt" - p."requestedAt")) / 3600.0) FROM payout_filtered p
        WHERE p."analyticsStatus" = 'COMPLETED' AND NOT p."invalidDuration" AND p."completedAt" >= period.first AND p."completedAt" < period.last),
      'reconciliationRequiredCount', (SELECT count(*) FROM payout_filtered p WHERE p."requestedAt" >= period.first AND p."requestedAt" < period.last AND p."analyticsStatus" = 'RECONCILIATION_REQUIRED'),
      'legacyNoAttemptCount', (SELECT count(*) FROM payout_filtered p WHERE p."legacyNoAttempt" AND p."completedAt" >= period.first AND p."completedAt" < period.last),
      'providerAttemptCount', COALESCE((SELECT sum(p."attemptCount") FROM payout_filtered p WHERE p."requestedAt" >= period.first AND p."requestedAt" < period.last), 0),
      'invalidDurationCount', (SELECT count(*) FROM payout_filtered p WHERE p."invalidDuration" AND p."completedAt" >= period.first AND p."completedAt" < period.last)
    ) AS value FROM periods period
  ), payout_request_buckets AS (
    SELECT date_trunc(${unit}, "requestedAt" + interval '8 hours') AS bucket, count(*) AS count, sum(amount::numeric) AS amount
    FROM payout_filtered WHERE "requestedAt" >= (SELECT first FROM periods WHERE key = 'current')
      AND "requestedAt" < (SELECT last FROM periods WHERE key = 'current') GROUP BY 1
  ), payout_completion_buckets AS (
    SELECT date_trunc(${unit}, "completedAt" + interval '8 hours') AS bucket, count(*) AS count, sum(amount::numeric) AS amount
    FROM payout_filtered WHERE "analyticsStatus" = 'COMPLETED' AND "completedAt" >= (SELECT first FROM periods WHERE key = 'current')
      AND "completedAt" < (SELECT last FROM periods WHERE key = 'current') GROUP BY 1
  ), payout_activity_trend AS (
    SELECT b.bucket, COALESCE(r.count, 0) AS "requestedCount", COALESCE(r.amount, 0) AS "requestedAmount",
      COALESCE(c.count, 0) AS "completedCount", COALESCE(c.amount, 0) AS "completedAmount"
    FROM buckets b LEFT JOIN payout_request_buckets r USING (bucket) LEFT JOIN payout_completion_buckets c USING (bucket)
  ), payout_failure_buckets AS (
    SELECT date_trunc(${unit}, "terminalAt" + interval '8 hours') AS bucket, count(*) AS count
    FROM payout_filtered WHERE "analyticsStatus" IN ('FAILED', 'REJECTED')
      AND "terminalAt" >= (SELECT first FROM periods WHERE key = 'current')
      AND "terminalAt" < (SELECT last FROM periods WHERE key = 'current') GROUP BY 1
  ), payout_outcome_trend AS (
    SELECT b.bucket, COALESCE(c.count, 0) AS completed, COALESCE(f.count, 0) AS "failedRejected"
    FROM buckets b LEFT JOIN payout_completion_buckets c USING (bucket) LEFT JOIN payout_failure_buckets f USING (bucket)
  ), payout_status_distribution AS (
    SELECT "analyticsStatus" AS key,
      CASE "analyticsStatus" WHEN 'PENDING' THEN 'Pending' WHEN 'APPROVED' THEN 'Approved'
        WHEN 'PROCESSING' THEN 'Processing' WHEN 'COMPLETED' THEN 'Completed' WHEN 'FAILED' THEN 'Failed'
        WHEN 'REJECTED' THEN 'Rejected' WHEN 'CANCELLED' THEN 'Cancelled' ELSE 'Reconciliation Required' END AS label,
      count(*) AS count
    FROM payout_filtered WHERE "requestedAt" >= (SELECT first FROM periods WHERE key = 'current')
      AND "requestedAt" < (SELECT last FROM periods WHERE key = 'current') GROUP BY 1, 2
  ), payout_methods AS (
    SELECT COALESCE("payoutMethodTypeSnapshot"::text, 'UNAVAILABLE') AS key,
      CASE "payoutMethodTypeSnapshot"::text WHEN 'BANK_TRANSFER' THEN 'Bank transfer' WHEN 'GCASH' THEN 'GCash'
        WHEN 'PAYMAYA' THEN 'Maya' WHEN 'CHECK' THEN 'Check' ELSE 'Legacy method unavailable' END AS label,
      count(*) AS "completedCount", sum(amount::numeric) AS "completedAmount"
    FROM payout_filtered WHERE "analyticsStatus" = 'COMPLETED'
      AND "completedAt" >= (SELECT first FROM periods WHERE key = 'current')
      AND "completedAt" < (SELECT last FROM periods WHERE key = 'current') GROUP BY 1, 2
  ), payout_rows AS (
    SELECT id, 'WD-' || lpad(id::text, 6, '0') AS reference, amount::numeric AS amount,
      status::text AS "withdrawalStatus", "analyticsStatus", "requestedAt", "approvedAt", "completedAt", "terminalAt",
      CASE WHEN "completedAt" >= "requestedAt" THEN EXTRACT(epoch FROM ("completedAt" - "requestedAt")) / 3600.0 END AS "processingHours",
      COALESCE("payoutMethodTypeSnapshot"::text, 'UNAVAILABLE') AS "methodType",
      CASE "payoutMethodTypeSnapshot"::text WHEN 'BANK_TRANSFER' THEN 'Bank transfer' WHEN 'GCASH' THEN 'GCash'
        WHEN 'PAYMAYA' THEN 'Maya' WHEN 'CHECK' THEN 'Check' ELSE 'Legacy method unavailable' END AS "methodLabel",
      "payoutDestinationMasked" AS "destinationMasked", "attemptCount", "latestAttemptStatus", provider,
      "providerReference", "legacyNoAttempt", "requiresReconciliation" AS "reconciliationRequired", "invalidDuration",
      CASE WHEN "requestedAt" >= (SELECT first FROM periods WHERE key = 'current')
        AND "requestedAt" < (SELECT last FROM periods WHERE key = 'current')
        AND (("completedAt" >= (SELECT first FROM periods WHERE key = 'current') AND "completedAt" < (SELECT last FROM periods WHERE key = 'current'))
          OR ("terminalAt" >= (SELECT first FROM periods WHERE key = 'current') AND "terminalAt" < (SELECT last FROM periods WHERE key = 'current'))) THEN 'REQUEST_AND_OUTCOME'
        WHEN "requestedAt" >= (SELECT first FROM periods WHERE key = 'current') THEN 'REQUEST'
        ELSE 'OUTCOME' END AS "periodScope", environment::text AS environment
    FROM payout_filtered WHERE ("requestedAt" >= (SELECT first FROM periods WHERE key = 'current')
      AND "requestedAt" < (SELECT last FROM periods WHERE key = 'current'))
      OR ("completedAt" >= (SELECT first FROM periods WHERE key = 'current') AND "completedAt" < (SELECT last FROM periods WHERE key = 'current') AND "analyticsStatus" = 'COMPLETED')
      OR ("terminalAt" >= (SELECT first FROM periods WHERE key = 'current') AND "terminalAt" < (SELECT last FROM periods WHERE key = 'current') AND "analyticsStatus" IN ('FAILED', 'REJECTED'))
  ), payout_page_meta AS (
    SELECT count(*) AS total, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int AS total_pages,
      LEAST(${options.page}, GREATEST(1, ceil(count(*)::numeric / ${options.limit}))::int) AS page FROM payout_rows
  ), payout_page AS (
    SELECT * FROM payout_rows ORDER BY ${options.order} LIMIT ${options.limit}
    OFFSET (SELECT (page - 1) * ${options.limit} FROM payout_page_meta)
  )`;
}

export function payoutAnalyticsJSON(options: ReturnType<typeof payoutPageOptions>) {
  return Prisma.sql`json_build_object(
    'metrics', (SELECT value FROM payout_metrics WHERE period = 'current'),
    'previousMetrics', (SELECT value FROM payout_metrics WHERE period = 'previous'),
    'activityTrend', COALESCE((SELECT json_agg(a ORDER BY bucket) FROM payout_activity_trend a), '[]'::json),
    'outcomeTrend', COALESCE((SELECT json_agg(o ORDER BY bucket) FROM payout_outcome_trend o), '[]'::json),
    'statusDistribution', COALESCE((SELECT json_agg(json_build_object('key', key, 'label', label, 'count', count,
      'percentage', 100.0 * count / NULLIF((SELECT sum(count) FROM payout_status_distribution), 0)) ORDER BY count DESC, key)
      FROM payout_status_distribution), '[]'::json),
    'methodBreakdown', COALESCE((SELECT json_agg(m ORDER BY "completedAmount" DESC, key) FROM payout_methods m), '[]'::json),
    'history', json_build_object('items', COALESCE((SELECT json_agg(p ORDER BY ${options.order}) FROM payout_page p), '[]'::json),
      'total', (SELECT total FROM payout_page_meta), 'page', (SELECT page FROM payout_page_meta), 'limit', ${options.limit},
      'totalPages', (SELECT total_pages FROM payout_page_meta), 'sort', ${options.sort}, 'direction', ${options.direction})
  )`;
}
