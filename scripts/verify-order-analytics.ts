import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { analyticsRange, getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';
import { orderPageOptions } from '../src/services/supplierOrderAnalytics.sql.js';

const close = (left: number, right: number) => assert.ok(Math.abs(left - right) < 0.005, `${left} does not reconcile with ${right}`);
const dateKey = (value: Date) => new Date(value.valueOf() + 8 * 3600000).toISOString().slice(0, 10);

export async function verifyOrderAnalytics(prisma: PrismaClient) {
  for (const invalid of [{ orderPage: 0 }, { orderLimit: 21 }, { orderSort: 'DROP TABLE' }, { orderDirection: 'SIDEWAYS' }]) assert.throws(() => orderPageOptions(invalid));
  console.log('PASS: order pagination and sort whitelist');

  const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
  const sample = await prisma.purchaseOrderSettlement.findFirst({ where: { environment, status: 'SETTLED' }, orderBy: { settledAt: 'desc' } });
  if (!sample) throw new Error(`No ${environment} settlement is available for operational-order verification.`);
  const purchaseOrder = await prisma.purchaseOrder.findUnique({ where: { id: sample.purchaseOrderId } });
  if (!purchaseOrder) throw new Error(`Settlement ${sample.id} has no matching purchase order.`);
  const day = dateKey(purchaseOrder.createdAt);
  const exact = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day, search: purchaseOrder.poNumber });
  const exactOrders = exact.orderAnalytics;
  assert.equal(exactOrders.metrics.totalOrders, 1);
  assert.equal(exactOrders.performance.total, 1);
  assert.equal(exactOrders.performance.items[0]?.id, sample.purchaseOrderId);
  assert.equal(exactOrders.statusDistribution.reduce((sum: number, row: any) => sum + row.count, 0), 1);
  assert.equal(exactOrders.volumeTrend.reduce((sum: number, row: any) => sum + row.created, 0), 1);
  assert.ok(exactOrders.performance.items.every((row: any) => row.fulfillmentHours === null || row.fulfillmentHours >= 0));
  assert.ok(exactOrders.slowestOrders.every((row: any) => row.fulfillmentHours !== null && row.fulfillmentHours >= 0));
  console.log('PASS: exact operational PO, status distribution, created trend, no line-item multiplication and non-negative durations', { day, status: purchaseOrder.status });

  const range = analyticsRange(day, day);
  const report = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day });
  const orders = report.orderAnalytics;
  assert.equal(orders.statusDistribution.reduce((sum: number, row: any) => sum + row.count, 0), orders.metrics.totalOrders);
  assert.equal(orders.volumeTrend.reduce((sum: number, row: any) => sum + row.created, 0), orders.metrics.totalOrders);
  assert.ok(orders.volumeTrend.length === 1 && orders.volumeTrend[0].bucket === day);
  assert.equal(orders.performance.total, orders.metrics.totalOrders);
  assert.equal(new Set(orders.performance.items.map((row: any) => row.id)).size, orders.performance.items.length);
  assert.ok(orders.backlog.every((row: any) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(row.status)));
  assert.ok(orders.stageDurations.every((row: any) => row.sampleCount > 0 && row.averageHours >= 0));
  assert.ok(orders.slowestOrders.every((row: any) => row.fulfillmentHours >= 0));
  assert.ok(orders.deliveryPerformance.eligibleOrders >= orders.deliveryPerformance.onTimeOrders + orders.deliveryPerformance.lateOrders);
  if (orders.deliveryPerformance.onTimeRate !== null) close(orders.deliveryPerformance.onTimeRate, 100 * orders.deliveryPerformance.onTimeOrders / orders.deliveryPerformance.eligibleOrders);
  const empty = await getSupplierAnalytics(prisma, sample.supplierOrgId, { startDate: day, endDate: day, search: '__orders_analytics_no_match_98431__', orderPage: 999999 });
  assert.equal(empty.orderAnalytics.metrics.totalOrders, 0);
  assert.equal(empty.orderAnalytics.performance.total, 0);
  assert.equal(empty.orderAnalytics.performance.page, 1);
  assert.equal(empty.orderAnalytics.volumeTrend[0].created, 0);
  assert.equal(empty.orderAnalytics.volumeTrend[0].completed, 0);
  console.log('PASS: operational totals/trends, stage and delivery validity, current-backlog terminal exclusion, empty search and page clamping', { range: range.startDate + ' to ' + range.endDate, metrics: orders.metrics });
}

if (process.argv[1]?.endsWith('verify-order-analytics.ts')) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  verifyOrderAnalytics(prisma).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
