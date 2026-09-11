import { objectType } from 'nexus';
export const SupplierFeeMetrics = objectType({ name: 'SupplierFeeMetrics', definition(t) {
        t.nonNull.float('platformFees');
        t.nonNull.float('grossSettled');
        t.nonNull.float('netEarnings');
        t.float('effectiveFeeRate');
        t.float('averageFee');
        t.nonNull.int('settlementsWithFees');
        t.nonNull.int('settlementCount');
    } });
export const SupplierFeeTrend = objectType({ name: 'SupplierFeeTrend', definition(t) {
        t.nonNull.string('bucket');
        t.nonNull.float('grossSettled');
        t.nonNull.float('platformFees');
        t.nonNull.float('netEarnings');
        t.float('effectiveFeeRate');
        t.nonNull.int('settlementCount');
    } });
export const SupplierFeeComposition = objectType({ name: 'SupplierFeeComposition', definition(t) {
        t.nonNull.string('key');
        t.nonNull.string('label');
        t.nonNull.int('settlementCount');
        t.nonNull.float('platformFees');
        t.nonNull.float('percentage');
    } });
export const SupplierFeeHistoryItem = objectType({ name: 'SupplierFeeHistoryItem', definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('poId');
        t.nonNull.string('poNumber');
        t.nonNull.string('settledAt');
        t.nonNull.float('gross');
        t.nonNull.float('fee');
        t.nonNull.float('net');
        t.float('effectiveRate');
        t.string('feeRuleId');
        t.float('snapshotRate');
        t.string('snapshotRateType');
        t.string('snapshotCategory');
        t.string('snapshotUnitType');
        t.nonNull.string('environment');
        t.nonNull.string('postingState');
    } });
export const SupplierAnalyticsFeeHistoryPage = objectType({ name: 'SupplierAnalyticsFeeHistoryPage', definition(t) {
        t.nonNull.list.nonNull.field('items', { type: SupplierFeeHistoryItem });
        t.nonNull.int('total');
        t.nonNull.int('page');
        t.nonNull.int('limit');
        t.nonNull.int('totalPages');
        t.nonNull.string('sort');
        t.nonNull.string('direction');
    } });
export const SupplierFeeAnalytics = objectType({ name: 'SupplierFeeAnalytics', definition(t) {
        t.nonNull.field('metrics', { type: SupplierFeeMetrics });
        t.nonNull.field('previousMetrics', { type: SupplierFeeMetrics });
        t.nonNull.list.nonNull.field('trend', { type: SupplierFeeTrend });
        t.nonNull.list.nonNull.field('composition', { type: SupplierFeeComposition });
        t.nonNull.list.nonNull.field('highestFeeSettlements', { type: SupplierFeeHistoryItem });
        t.nonNull.field('history', { type: SupplierAnalyticsFeeHistoryPage });
    } });
export const SupplierPayoutMetrics = objectType({ name: 'SupplierPayoutMetrics', definition(t) {
        t.nonNull.int('requestedCount');
        t.nonNull.float('requestedAmount');
        t.nonNull.int('completedCount');
        t.nonNull.float('paidOutAmount');
        t.nonNull.int('processingPendingCount');
        t.nonNull.int('failedRejectedCount');
        t.float('successRate');
        t.float('averageProcessingHours');
        t.nonNull.int('reconciliationRequiredCount');
        t.nonNull.int('legacyNoAttemptCount');
        t.nonNull.int('providerAttemptCount');
        t.nonNull.int('invalidDurationCount');
    } });
export const SupplierPayoutActivityTrend = objectType({ name: 'SupplierPayoutActivityTrend', definition(t) {
        t.nonNull.string('bucket');
        t.nonNull.int('requestedCount');
        t.nonNull.float('requestedAmount');
        t.nonNull.int('completedCount');
        t.nonNull.float('completedAmount');
    } });
export const SupplierPayoutOutcomeTrend = objectType({ name: 'SupplierPayoutOutcomeTrend', definition(t) {
        t.nonNull.string('bucket');
        t.nonNull.int('completed');
        t.nonNull.int('failedRejected');
    } });
export const SupplierPayoutDistribution = objectType({ name: 'SupplierPayoutDistribution', definition(t) {
        t.nonNull.string('key');
        t.nonNull.string('label');
        t.nonNull.int('count');
        t.nonNull.float('percentage');
    } });
export const SupplierPayoutMethod = objectType({ name: 'SupplierPayoutMethod', definition(t) {
        t.nonNull.string('key');
        t.nonNull.string('label');
        t.nonNull.int('completedCount');
        t.nonNull.float('completedAmount');
    } });
export const SupplierPayoutHistoryItem = objectType({ name: 'SupplierPayoutHistoryItem', definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('reference');
        t.nonNull.float('amount');
        t.nonNull.string('withdrawalStatus');
        t.nonNull.string('analyticsStatus');
        t.nonNull.string('requestedAt');
        t.string('approvedAt');
        t.string('completedAt');
        t.string('terminalAt');
        t.float('processingHours');
        t.nonNull.string('methodType');
        t.nonNull.string('methodLabel');
        t.string('destinationMasked');
        t.nonNull.int('attemptCount');
        t.string('latestAttemptStatus');
        t.string('provider');
        t.string('providerReference');
        t.nonNull.boolean('legacyNoAttempt');
        t.nonNull.boolean('reconciliationRequired');
        t.nonNull.boolean('invalidDuration');
        t.nonNull.string('periodScope');
        t.nonNull.string('environment');
    } });
export const SupplierPayoutHistoryPage = objectType({ name: 'SupplierPayoutHistoryPage', definition(t) {
        t.nonNull.list.nonNull.field('items', { type: SupplierPayoutHistoryItem });
        t.nonNull.int('total');
        t.nonNull.int('page');
        t.nonNull.int('limit');
        t.nonNull.int('totalPages');
        t.nonNull.string('sort');
        t.nonNull.string('direction');
    } });
export const SupplierPayoutAnalytics = objectType({ name: 'SupplierPayoutAnalytics', definition(t) {
        t.nonNull.field('metrics', { type: SupplierPayoutMetrics });
        t.nonNull.field('previousMetrics', { type: SupplierPayoutMetrics });
        t.nonNull.list.nonNull.field('activityTrend', { type: SupplierPayoutActivityTrend });
        t.nonNull.list.nonNull.field('outcomeTrend', { type: SupplierPayoutOutcomeTrend });
        t.nonNull.list.nonNull.field('statusDistribution', { type: SupplierPayoutDistribution });
        t.nonNull.list.nonNull.field('methodBreakdown', { type: SupplierPayoutMethod });
        t.nonNull.field('history', { type: SupplierPayoutHistoryPage });
    } });
