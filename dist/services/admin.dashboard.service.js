import { prisma } from '../lib/prisma.js';
import { startOfDay, endOfDay, } from 'date-fns';
// ─── Service ──────────────────────────────────────────────────────────────────
export class AdminDashboardService {
    /**
     * Returns all dashboard data in a single optimised call.
     * Uses Promise.all to fan-out independent queries concurrently
     * and Prisma aggregate/count to avoid N+1 patterns.
     *
     * @param filter  Optional date range. Defaults to today when omitted.
     */
    async getDashboard(filter) {
        const now = new Date();
        // Resolve range — fall back to today
        const rangeStart = filter?.startDate
            ? startOfDay(new Date(filter.startDate))
            : startOfDay(now);
        const rangeEnd = filter?.endDate
            ? endOfDay(new Date(filter.endDate))
            : endOfDay(now);
        const [
        // ── Platform-wide counts (never date-filtered) ───────────
        totalOrganizations, activeOrganizations, totalUsers, activeUsers, totalOutlets, totalProducts, 
        // ── Range-scoped order counts ────────────────────────────
        totalPOSOrdersInRange, totalEcommerceOrdersInRange, 
        // ── Range-scoped sales aggregates ────────────────────────
        posSalesAggregate, ecommerceSalesAggregate, 
        // ── Range-scoped growth ──────────────────────────────────
        newOrganizationsInRange, newUsersInRange, 
        // ── Recent records (always latest 5, no date filter) ─────
        recentOrganizations, recentUsers, recentPOSOrders, recentEcommerceOrders,] = await Promise.all([
            // totalOrganizations
            prisma.organization.count({ where: { deletedAt: null } }),
            // activeOrganizations (no suspended field → same as total)
            prisma.organization.count({ where: { deletedAt: null } }),
            // totalUsers
            prisma.user.count({ where: { deletedAt: null } }),
            // activeUsers
            prisma.user.count({ where: { isActive: true, deletedAt: null } }),
            // totalOutlets
            prisma.outlet.count({ where: { deletedAt: null } }),
            // totalProducts (Items)
            prisma.item.count({ where: { deletedAt: null } }),
            // POS order count — date range
            prisma.salesOrder.count({
                where: {
                    deletedAt: null,
                    date: { gte: rangeStart, lte: rangeEnd },
                },
            }),
            // Ecommerce order count — date range
            prisma.kompraCOrder.count({
                where: {
                    deletedAt: null,
                    createdAt: { gte: rangeStart, lte: rangeEnd },
                },
            }),
            // POS sales aggregate — date range
            prisma.salesOrder.aggregate({
                _sum: { grandTotal: true },
                where: {
                    deletedAt: null,
                    date: { gte: rangeStart, lte: rangeEnd },
                },
            }),
            // Ecommerce sales aggregate — date range
            prisma.kompraCOrder.aggregate({
                _sum: { grandTotal: true },
                where: {
                    deletedAt: null,
                    createdAt: { gte: rangeStart, lte: rangeEnd },
                },
            }),
            // New orgs — date range
            prisma.organization.count({
                where: {
                    deletedAt: null,
                    createdAt: { gte: rangeStart, lte: rangeEnd },
                },
            }),
            // New users — date range
            prisma.user.count({
                where: {
                    deletedAt: null,
                    createdAt: { gte: rangeStart, lte: rangeEnd },
                },
            }),
            // Recent orgs — latest 5, no date filter
            prisma.organization.findMany({
                where: { deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, name: true, createdAt: true, roles: true },
            }),
            // Recent users — latest 5, no date filter
            prisma.user.findMany({
                where: { deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    fullname: true,
                    email: true,
                    isVerified: true,
                    isActive: true,
                    createdAt: true,
                },
            }),
            // Recent POS orders — latest 5, no date filter
            prisma.salesOrder.findMany({
                where: { deletedAt: null },
                orderBy: { date: 'desc' },
                take: 5,
                select: {
                    id: true,
                    orderNumber: true,
                    customerName: true,
                    status: true,
                    grandTotal: true,
                    date: true,
                },
            }),
            // Recent ecommerce orders — latest 5, no date filter
            prisma.kompraCOrder.findMany({
                where: { deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    transactionNumber: true,
                    paymentStatus: true,
                    status: true,
                    grandTotal: true,
                    createdAt: true,
                },
            }),
        ]);
        return {
            stats: {
                totalOrganizations,
                activeOrganizations,
                totalUsers,
                activeUsers,
                totalOutlets,
                totalProducts,
                totalPOSOrdersInRange,
                totalEcommerceOrdersInRange,
                totalPOSSalesInRange: posSalesAggregate._sum.grandTotal ?? 0,
                totalEcommerceSalesInRange: ecommerceSalesAggregate._sum.grandTotal ?? 0,
                newOrganizationsInRange,
                newUsersInRange,
            },
            recentOrganizations: recentOrganizations.map((org) => ({
                ...org,
                roles: org.roles,
            })),
            recentUsers,
            recentPOSOrders: recentPOSOrders.map((order) => ({
                ...order,
                status: order.status,
            })),
            recentEcommerceOrders: recentEcommerceOrders.map((order) => ({
                ...order,
                status: order.status,
            })),
            appliedStartDate: rangeStart.toISOString(),
            appliedEndDate: rangeEnd.toISOString(),
        };
    }
}
export const adminDashboardService = new AdminDashboardService();
