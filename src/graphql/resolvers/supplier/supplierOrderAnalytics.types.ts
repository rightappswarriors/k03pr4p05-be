import { objectType } from 'nexus';

export const SupplierOrderMetrics = objectType({ name: 'SupplierOrderMetrics', definition(t) {
  t.nonNull.int('totalOrders'); t.nonNull.int('completedOrders'); t.nonNull.int('inProgressOrders'); t.nonNull.int('cancelledRejected');
  t.float('completionRate'); t.float('averageFulfillmentHours'); t.nonNull.int('invalidDurationCount');
} });
export const SupplierOrderVolumeTrend = objectType({ name: 'SupplierOrderVolumeTrend', definition(t) {
  t.nonNull.string('bucket'); t.nonNull.int('created'); t.nonNull.int('completed');
} });
export const SupplierOrderStatusDistribution = objectType({ name: 'SupplierOrderStatusDistribution', definition(t) {
  t.nonNull.string('label'); t.nonNull.int('count'); t.nonNull.float('percentage');
} });
export const SupplierOrderStageDuration = objectType({ name: 'SupplierOrderStageDuration', definition(t) {
  t.nonNull.string('stage'); t.nonNull.float('averageHours'); t.nonNull.int('sampleCount');
} });
export const SupplierOrderDeliveryPerformance = objectType({ name: 'SupplierOrderDeliveryPerformance', definition(t) {
  t.nonNull.int('deliveredOrders'); t.nonNull.int('eligibleOrders'); t.nonNull.int('onTimeOrders'); t.nonNull.int('lateOrders');
  t.float('onTimeRate'); t.float('averageDelayDays');
} });
export const SupplierOrderBacklog = objectType({ name: 'SupplierOrderBacklog', definition(t) {
  t.nonNull.string('status'); t.nonNull.int('count');
} });
export const SupplierOrderAging = objectType({ name: 'SupplierOrderAging', definition(t) {
  t.nonNull.string('bucket'); t.nonNull.int('count');
} });
export const SupplierOrderPerformance = objectType({ name: 'SupplierOrderPerformance', definition(t) {
  t.nonNull.string('id'); t.nonNull.string('poNumber'); t.nonNull.string('buyerName'); t.nonNull.string('status'); t.nonNull.string('source');
  t.nonNull.string('supplierConfirmation'); t.nonNull.string('paymentStatus'); t.nonNull.string('deliveryStatus');
  t.nonNull.string('createdAt'); t.string('supplierConfirmedAt'); t.string('completedAt'); t.nonNull.float('totalAmount'); t.nonNull.int('itemCount'); t.float('fulfillmentHours');
} });
export const SupplierOrderPage = objectType({ name: 'SupplierOrderPage', definition(t) {
  t.nonNull.list.nonNull.field('items', { type: SupplierOrderPerformance });
  t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('limit'); t.nonNull.int('totalPages'); t.nonNull.string('sort'); t.nonNull.string('direction');
} });
export const SupplierOrderAnalytics = objectType({ name: 'SupplierOrderAnalytics', definition(t) {
  t.nonNull.field('metrics', { type: SupplierOrderMetrics }); t.nonNull.field('previousMetrics', { type: SupplierOrderMetrics });
  t.nonNull.list.nonNull.field('volumeTrend', { type: SupplierOrderVolumeTrend });
  t.nonNull.list.nonNull.field('statusDistribution', { type: SupplierOrderStatusDistribution });
  t.nonNull.list.nonNull.field('stageDurations', { type: SupplierOrderStageDuration });
  t.nonNull.field('deliveryPerformance', { type: SupplierOrderDeliveryPerformance });
  t.nonNull.list.nonNull.field('backlog', { type: SupplierOrderBacklog }); t.nonNull.list.nonNull.field('aging', { type: SupplierOrderAging });
  t.nonNull.list.nonNull.field('slowestOrders', { type: SupplierOrderPerformance }); t.nonNull.field('performance', { type: SupplierOrderPage });
} });
