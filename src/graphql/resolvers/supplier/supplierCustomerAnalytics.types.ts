import { objectType } from 'nexus';

export const SupplierCustomerMetrics = objectType({ name: 'SupplierCustomerMetrics', definition(t) {
  t.nonNull.int('uniqueCustomers'); t.nonNull.int('newCustomers'); t.nonNull.int('returningCustomers');
  t.nonNull.float('revenue'); t.float('averageOrderValue'); t.float('repeatCustomerRate');
} });
export const SupplierCustomerPerformance = objectType({ name: 'SupplierCustomerPerformance', definition(t) {
  t.nonNull.string('customerKey'); t.nonNull.string('displayName'); t.nonNull.string('customerType'); t.nonNull.string('status');
  t.nonNull.float('revenue'); t.nonNull.float('fees'); t.nonNull.float('netEarnings'); t.nonNull.int('settledOrders');
  t.nonNull.float('averageOrderValue'); t.nonNull.string('firstPurchase'); t.nonNull.string('latestPurchase');
  t.nonNull.float('contribution'); t.nonNull.float('previousRevenue');
} });
export const SupplierCustomerRevenueTrend = objectType({ name: 'SupplierCustomerRevenueTrend', definition(t) {
  t.nonNull.string('bucket'); t.nonNull.float('revenue'); t.nonNull.int('activeCustomers');
} });
export const SupplierCustomerLifecycleTrend = objectType({ name: 'SupplierCustomerLifecycleTrend', definition(t) {
  t.nonNull.string('bucket'); t.nonNull.int('newCustomers'); t.nonNull.int('returningCustomers');
} });
export const SupplierCustomerContribution = objectType({ name: 'SupplierCustomerContribution', definition(t) {
  t.nonNull.string('key'); t.nonNull.string('name'); t.nonNull.float('amount'); t.nonNull.float('percentage');
} });
export const SupplierCustomerConcentration = objectType({ name: 'SupplierCustomerConcentration', definition(t) {
  t.nonNull.float('top1Share'); t.nonNull.float('top3Share'); t.nonNull.float('top5Share');
} });
export const SupplierCustomerDiagnostic = objectType({ name: 'SupplierCustomerDiagnostic', definition(t) {
  t.nonNull.string('period'); t.nonNull.int('unresolvedSettlements'); t.nonNull.float('unresolvedGross');
  t.nonNull.float('unresolvedFees'); t.nonNull.float('unresolvedNet');
} });
export const SupplierCustomerPage = objectType({ name: 'SupplierCustomerPage', definition(t) {
  t.nonNull.list.nonNull.field('items', { type: SupplierCustomerPerformance });
  t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('limit'); t.nonNull.int('totalPages');
  t.nonNull.string('sort'); t.nonNull.string('direction');
} });
export const SupplierCustomerAnalytics = objectType({ name: 'SupplierCustomerAnalytics', definition(t) {
  t.nonNull.field('metrics', { type: SupplierCustomerMetrics }); t.nonNull.field('previousMetrics', { type: SupplierCustomerMetrics });
  t.nonNull.list.nonNull.field('revenueTrend', { type: SupplierCustomerRevenueTrend });
  t.nonNull.list.nonNull.field('lifecycleTrend', { type: SupplierCustomerLifecycleTrend });
  t.nonNull.list.nonNull.field('topCustomers', { type: SupplierCustomerPerformance });
  t.nonNull.list.nonNull.field('contribution', { type: SupplierCustomerContribution });
  t.nonNull.field('concentration', { type: SupplierCustomerConcentration });
  t.nonNull.list.nonNull.field('diagnostics', { type: SupplierCustomerDiagnostic });
  t.nonNull.field('performance', { type: SupplierCustomerPage });
} });
