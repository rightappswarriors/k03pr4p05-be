import { extendType, objectType, nullable, stringArg } from 'nexus';
import { adminDashboardService } from '../../../services/admin.dashboard.service.js';

// ─── Object Types ─────────────────────────────────────────────────────────────

export const DashboardStats = objectType({
  name: 'DashboardStats',
  definition(t) {
    // Platform-wide (never date-filtered)
    t.nonNull.int('totalOrganizations');
    t.nonNull.int('activeOrganizations');
    t.nonNull.int('totalUsers');
    t.nonNull.int('activeUsers');
    t.nonNull.int('totalOutlets');
    t.nonNull.int('totalProducts');
    // Range-scoped
    t.nonNull.int('totalPOSOrdersInRange');
    t.nonNull.int('totalEcommerceOrdersInRange');
    t.nonNull.float('totalPOSSalesInRange');
    t.nonNull.float('totalEcommerceSalesInRange');
    t.nonNull.int('newOrganizationsInRange');
    t.nonNull.int('newUsersInRange');
  },
});

export const DashboardRecentOrganization = objectType({
  name: 'DashboardRecentOrganization',
  definition(t) {
    t.nonNull.int('id');
    t.nonNull.string('name');
    t.nonNull.string('createdAt');
    t.nonNull.list.nonNull.string('roles');
  },
});

export const DashboardRecentUser = objectType({
  name: 'DashboardRecentUser',
  definition(t) {
    t.nonNull.int('id');
    t.nonNull.string('fullname');
    t.nonNull.string('email');
    t.nonNull.boolean('isVerified');
    t.nonNull.boolean('isActive');
    t.nonNull.string('createdAt');
  },
});

export const DashboardRecentPOSOrder = objectType({
  name: 'DashboardRecentPOSOrder',
  definition(t) {
    t.nonNull.string('id');
    t.nonNull.string('orderNumber');
    t.string('customerName');
    t.nonNull.string('status');
    t.nonNull.float('grandTotal');
    t.nonNull.string('date');
  },
});

export const DashboardRecentEcommerceOrder = objectType({
  name: 'DashboardRecentEcommerceOrder',
  definition(t) {
    t.nonNull.int('id');
    t.nonNull.string('transactionNumber');
    t.nonNull.string('paymentStatus');
    t.nonNull.string('status');
    t.float('grandTotal');
    t.nonNull.string('createdAt');
  },
});

export const AdminDashboardResult = objectType({
  name: 'AdminDashboardResult',
  definition(t) {
    t.nonNull.field('stats', { type: 'DashboardStats' });
    t.nonNull.list.nonNull.field('recentOrganizations', {
      type: 'DashboardRecentOrganization',
    });
    t.nonNull.list.nonNull.field('recentUsers', {
      type: 'DashboardRecentUser',
    });
    t.nonNull.list.nonNull.field('recentPOSOrders', {
      type: 'DashboardRecentPOSOrder',
    });
    t.nonNull.list.nonNull.field('recentEcommerceOrders', {
      type: 'DashboardRecentEcommerceOrder',
    });
    /** ISO strings echoed back so the client knows what range was applied */
    t.nonNull.string('appliedStartDate');
    t.nonNull.string('appliedEndDate');
  },
});

// ─── Query ────────────────────────────────────────────────────────────────────

export const AdminDashboardQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.field('adminDashboard', {
      type: 'AdminDashboardResult',
      description:
        'Returns aggregated KPIs and recent records for the System Admin Dashboard. ' +
        'startDate / endDate are ISO strings that scope the order and sales stats.',
      args: {
        startDate: nullable(stringArg()),
        endDate: nullable(stringArg()),
      },
      async resolve(_root, args, _ctx) {
        const data = await adminDashboardService.getDashboard({
          startDate: args.startDate ?? undefined,
          endDate: args.endDate ?? undefined,
        });

        return {
          stats: data.stats,
          recentOrganizations: data.recentOrganizations.map((org) => ({
            ...org,
            createdAt: org.createdAt.toISOString(),
          })),
          recentUsers: data.recentUsers.map((user) => ({
            ...user,
            createdAt: user.createdAt.toISOString(),
          })),
          recentPOSOrders: data.recentPOSOrders.map((order) => ({
            ...order,
            date: order.date.toISOString(),
          })),
          recentEcommerceOrders: data.recentEcommerceOrders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
          })),
          appliedStartDate: data.appliedStartDate,
          appliedEndDate: data.appliedEndDate,
        };
      },
    });
  },
});