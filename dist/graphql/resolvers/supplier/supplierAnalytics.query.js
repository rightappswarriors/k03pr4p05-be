import { extendType, inputObjectType, nonNull, objectType } from 'nexus';
import { requireApprovedSupplier } from '../../../middleware/auth.middleware.js';
import { getSupplierAnalytics } from '../../../services/supplierAnalytics.service.js';
import { SupplierCustomerAnalytics } from './supplierCustomerAnalytics.types.js';
import { SupplierProductAnalytics } from './supplierProductAnalytics.types.js';
import { SupplierOrderAnalytics } from './supplierOrderAnalytics.types.js';
import { SupplierFeeAnalytics, SupplierPayoutAnalytics } from './supplierFinanceAnalytics.types.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
export * from './supplierCustomerAnalytics.types.js';
export * from './supplierProductAnalytics.types.js';
export * from './supplierOrderAnalytics.types.js';
export * from './supplierFinanceAnalytics.types.js';
export const SupplierAnalyticsInput = inputObjectType({ name: 'SupplierAnalyticsInput', definition(t) {
        t.nonNull.string('startDate');
        t.nonNull.string('endDate');
        t.string('search');
        t.int('productPage');
        t.int('productLimit');
        t.string('productSort');
        t.string('productDirection');
        t.int('customerPage');
        t.int('customerLimit');
        t.string('customerSort');
        t.string('customerDirection');
        t.int('orderPage');
        t.int('orderLimit');
        t.string('orderSort');
        t.string('orderDirection');
        t.int('feePage');
        t.int('feeLimit');
        t.string('feeSort');
        t.string('feeDirection');
        t.int('payoutPage');
        t.int('payoutLimit');
        t.string('payoutSort');
        t.string('payoutDirection');
    } });
export const SupplierAnalyticsRange = objectType({ name: 'SupplierAnalyticsRange', definition(t) {
        t.nonNull.string('startDate');
        t.nonNull.string('endDate');
    } });
export const SupplierAnalyticsMetrics = objectType({ name: 'SupplierAnalyticsMetrics', definition(t) {
        t.nonNull.float('grossSales');
        t.nonNull.float('netEarnings');
        t.nonNull.float('platformFees');
        t.nonNull.int('totalOrders');
        t.nonNull.int('productsSold');
        t.nonNull.int('customers');
        t.nonNull.int('settledOrders');
    } });
export const SupplierAnalyticsTrend = objectType({ name: 'SupplierAnalyticsTrend', definition(t) {
        t.nonNull.string('bucket');
        t.nonNull.float('grossSales');
        t.nonNull.float('netEarnings');
        t.nonNull.float('platformFees');
        t.nonNull.int('settledOrders');
    } });
export const SupplierAnalyticsCategory = objectType({ name: 'SupplierAnalyticsCategory', definition(t) {
        t.nonNull.string('key');
        t.nonNull.string('name');
        t.nonNull.float('amount');
        t.nonNull.float('percentage');
    } });
export const SupplierAnalyticsStatus = objectType({ name: 'SupplierAnalyticsStatus', definition(t) {
        t.nonNull.string('label');
        t.nonNull.int('count');
        t.nonNull.float('percentage');
    } });
export const SupplierAnalyticsProduct = objectType({ name: 'SupplierAnalyticsProduct', definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nonNull.int('quantity');
    } });
export const SupplierAnalyticsBuyer = objectType({ name: 'SupplierAnalyticsBuyer', definition(t) {
        t.nonNull.string('key');
        t.nonNull.string('name');
        t.nonNull.float('amount');
        t.nonNull.int('orderCount');
    } });
export const SupplierAnalyticsOrder = objectType({ name: 'SupplierAnalyticsOrder', definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('poNumber');
        t.nonNull.string('buyerName');
        t.nonNull.string('date');
        t.nonNull.int('itemCount');
        t.nonNull.float('grossAmount');
        t.nonNull.float('platformFee');
        t.nonNull.float('netAmount');
        t.nonNull.string('status');
    } });
export const SupplierAnalytics = objectType({ name: 'SupplierAnalytics', definition(t) {
        t.nonNull.field('range', { type: SupplierAnalyticsRange });
        t.nonNull.field('comparisonRange', { type: SupplierAnalyticsRange });
        t.nonNull.string('interval');
        t.nonNull.string('environment');
        t.nonNull.string('search');
        t.nonNull.string('supplierName');
        t.nonNull.field('productAnalytics', { type: SupplierProductAnalytics });
        t.nonNull.field('customerAnalytics', { type: SupplierCustomerAnalytics });
        t.nonNull.field('orderAnalytics', { type: SupplierOrderAnalytics });
        t.nonNull.field('feeAnalytics', { type: SupplierFeeAnalytics });
        t.nonNull.field('payoutAnalytics', { type: SupplierPayoutAnalytics });
        t.nonNull.field('kpis', { type: SupplierAnalyticsMetrics });
        t.nonNull.field('previousKpis', { type: SupplierAnalyticsMetrics });
        t.nonNull.list.nonNull.field('revenueTrend', { type: SupplierAnalyticsTrend });
        t.nonNull.list.nonNull.field('categorySales', { type: SupplierAnalyticsCategory });
        t.nonNull.list.nonNull.field('orderStatuses', { type: SupplierAnalyticsStatus });
        t.nonNull.list.nonNull.field('topProducts', { type: SupplierAnalyticsProduct });
        t.nonNull.list.nonNull.field('topCustomers', { type: SupplierAnalyticsBuyer });
        t.nonNull.list.nonNull.field('recentOrders', { type: SupplierAnalyticsOrder });
    } });
export const SupplierAnalyticsQuery = extendType({ type: 'Query', definition(t) {
        t.nonNull.field('supplierAnalytics', { type: SupplierAnalytics, args: { input: nonNull(SupplierAnalyticsInput) },
            async resolve(_, { input }, ctx) {
                requireApprovedSupplier(ctx);
                PAGE_PERMISSIONS.supplierAnalytics.view(ctx);
                return getSupplierAnalytics(ctx.prisma, Number(ctx.user?.orgId), input);
            },
        });
    } });
