import { objectType } from 'nexus';

export const SupplierProductMetrics = objectType({ name: 'SupplierProductMetrics', definition(t) {
  t.nonNull.float('revenue'); t.nonNull.float('fees'); t.nonNull.float('netEarnings'); t.nonNull.float('quantity');
  t.nonNull.int('settledOrders'); t.nonNull.int('activeSellingProducts');
  t.float('averageSellingValue'); t.nonNull.float('topProductContribution');
} });
export const SupplierProductPerformance = objectType({ name: 'SupplierProductPerformance', definition(t) {
  t.nonNull.string('itemId'); t.nonNull.string('name'); t.nonNull.string('sku'); t.nonNull.string('unit'); t.nonNull.string('category');
  t.nonNull.float('revenue'); t.nonNull.float('fees'); t.nonNull.float('netEarnings'); t.nonNull.float('quantity');
  t.nonNull.int('settledOrders'); t.float('averageSellingValue'); t.nonNull.float('previousRevenue'); t.nonNull.float('contribution');
} });
export const SupplierProductTrend = objectType({ name: 'SupplierProductTrend', definition(t) {
  t.nonNull.string('bucket'); t.nonNull.float('revenue'); t.nonNull.float('quantity'); t.nonNull.int('settledOrders');
} });
export const SupplierProductContribution = objectType({ name: 'SupplierProductContribution', definition(t) {
  t.nonNull.string('key'); t.nonNull.string('name'); t.nonNull.float('amount'); t.nonNull.float('percentage');
} });
export const SupplierProductDiagnostic = objectType({ name: 'SupplierProductDiagnostic', definition(t) {
  t.nonNull.string('period'); t.nonNull.string('reason'); t.nonNull.int('settledOrders');
  t.nonNull.float('unallocatedGross'); t.nonNull.float('unallocatedFees'); t.nonNull.float('unallocatedNet');
} });
export const SupplierProductPage = objectType({ name: 'SupplierProductPage', definition(t) {
  t.nonNull.list.nonNull.field('items', { type: SupplierProductPerformance });
  t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('limit'); t.nonNull.int('totalPages');
  t.nonNull.string('sort'); t.nonNull.string('direction');
} });
export const SupplierProductAnalytics = objectType({ name: 'SupplierProductAnalytics', definition(t) {
  t.nonNull.field('metrics', { type: SupplierProductMetrics }); t.nonNull.field('previousMetrics', { type: SupplierProductMetrics });
  t.nonNull.list.nonNull.field('trend', { type: SupplierProductTrend });
  t.nonNull.list.nonNull.field('topProducts', { type: SupplierProductPerformance });
  t.nonNull.list.nonNull.field('quantityLeaders', { type: SupplierProductPerformance });
  t.nonNull.list.nonNull.field('contribution', { type: SupplierProductContribution });
  t.nonNull.list.nonNull.field('diagnostics', { type: SupplierProductDiagnostic });
  t.nonNull.field('performance', { type: SupplierProductPage });
} });
