// src/graphql/resolvers/analytics/analytics.query.ts
// Nexus-based GraphQL queries for Sales Analytics
// Follows the same pattern as item.query.ts

import {
    extendType,
    nonNull,
    intArg,
    nullable,
    stringArg,
    enumType,
    objectType,
    list,
    floatArg,
    booleanArg,
} from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const DateRangePresetEnum = enumType({
    name: 'DateRangePreset',
    members: ['all', 'today', 'this_week', 'this_month', 'custom'],
});

export const ItemTrendEnum = enumType({
    name: 'ItemTrend',
    members: ['up', 'down', 'stable'],
});

export const ItemStatusEnum = enumType({
    name: 'ItemStatus',
    members: ['top_seller', 'stable', 'slow_mover', 'loss_item'],
});

// ─── Object Types ─────────────────────────────────────────────────────────────

export const AnalyticsSummaryType = objectType({
    name: 'AnalyticsSummary',
    definition(t) {
        t.nonNull.float('totalRevenue');
        t.nonNull.float('totalCost');
        t.nonNull.float('grossProfit');
        t.nonNull.float('profitMargin');
        t.nonNull.int('totalOrders');
        t.nonNull.int('totalItemsSold');
        t.nonNull.float('revenueChange');
        t.nonNull.float('profitChange');
        t.nonNull.int('profitableBranches');
        t.nonNull.int('totalBranches');
    },
});

export const BranchPerformanceType = objectType({
    name: 'BranchPerformance',
    definition(t) {
        t.nonNull.int('branchId');
        t.nonNull.string('branchName');
        t.nonNull.float('totalRevenue');
        t.nonNull.float('totalCost');
        t.nonNull.float('grossProfit');
        t.nonNull.float('profitMargin');
        t.nonNull.int('totalOrders');
        t.nonNull.float('deltaRevenue');
        t.nonNull.float('deltaProfit');
        t.nonNull.boolean('isProfitable');
        t.nonNull.list.nonNull.float('trend'); // sparkline values
    },
});

export const ItemPerformanceType = objectType({
    name: 'ItemPerformance',
    definition(t) {
        t.nonNull.int('itemId');
        t.nonNull.string('itemName');
        t.nullable.string('itemImage');
        t.nullable.string('categoryName');
        t.nonNull.float('totalRevenue');
        t.nonNull.float('totalCost');
        t.nonNull.float('grossProfit');
        t.nonNull.float('profitMargin');
        t.nonNull.int('unitsSold');
        t.nonNull.float('revenuePerUnit');
        t.nonNull.field('trend', { type: 'ItemTrend' });
        t.nonNull.float('trendPct');
        t.nonNull.field('status', { type: 'ItemStatus' });
    },
});

export const SalesTrendPointType = objectType({
    name: 'SalesTrendPoint',
    definition(t) {
        t.nonNull.string('label');
        t.nonNull.float('revenue');
        t.nonNull.float('cost');
        t.nonNull.float('profit');
        t.nonNull.int('orders');
    },
});

export const SalesAnalyticsPayloadType = objectType({
    name: 'SalesAnalyticsPayload',
    definition(t) {
        t.nonNull.field('summary', { type: 'AnalyticsSummary' });
        t.nonNull.list.nonNull.field('branches', { type: 'BranchPerformance' });
        t.nonNull.list.nonNull.field('topItems', { type: 'ItemPerformance' });
        t.nonNull.list.nonNull.field('bottomItems', { type: 'ItemPerformance' });
        t.nonNull.list.nonNull.field('trend', { type: 'SalesTrendPoint' });
    },
});

export const BranchAnalyticsPayloadType = objectType({
    name: 'BranchAnalyticsPayload',
    definition(t) {
        t.nonNull.field('branch', { type: 'BranchPerformance' });
        t.nonNull.list.nonNull.field('trend', { type: 'SalesTrendPoint' });
    },
});

export const ItemAnalyticsPayloadType = objectType({
    name: 'ItemAnalyticsPayload',
    definition(t) {
        t.nonNull.list.nonNull.field('topItems', { type: 'ItemPerformance' });
        t.nonNull.list.nonNull.field('bottomItems', { type: 'ItemPerformance' });
    },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the date window from a preset or explicit start/end.
 * Returns { currentStart, currentEnd, prevStart, prevEnd } for delta calculations.
 */
function resolveDateWindow(
    preset: string,
    startDate?: string | null,
    endDate?: string | null,
) {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date = new Date(now);

    switch (preset) {
        case 'today':
            currentStart = new Date(now);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd.setHours(23, 59, 59, 999);
            break;
        case 'this_week': {
            const day = now.getDay(); // 0=Sun
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - day);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd.setHours(23, 59, 59, 999);
            break;
        }
        case 'this_month':
            currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            currentEnd.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            if (!startDate || !endDate) throw new Error('custom preset requires startDate and endDate');
            currentStart = new Date(startDate);
            currentEnd = new Date(endDate);
            break;
        default: // 'all'
            currentStart = new Date('2000-01-01');
            currentEnd.setHours(23, 59, 59, 999);
    }

    // Previous period: same duration immediately before currentStart
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    return { currentStart, currentEnd, prevStart, prevEnd };
}

/** Build a sparkline of up to 6 data points within the window */
function buildSparkline(transactions: any[], start: Date, end: Date): number[] {
    const totalMs = end.getTime() - start.getTime();
    const bucketMs = totalMs / 6;
    const buckets = Array(6).fill(0);
    for (const tx of transactions) {
        const ts = new Date(tx.createdAt).getTime();
        const idx = Math.min(5, Math.floor((ts - start.getTime()) / bucketMs));
        buckets[idx] += Number(tx.total ?? 0);
    }
    return buckets;
}

/** Compute delta % between current and previous value */
function delta(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

/** Classify item performance status */
function classifyItem(
    profitMargin: number,
    trendPct: number,
    rank: number,
    totalItems: number,
): 'top_seller' | 'stable' | 'slow_mover' | 'loss_item' {
    if (profitMargin < 0) return 'loss_item';
    if (rank <= Math.ceil(totalItems * 0.2)) return 'top_seller';
    if (trendPct < -10) return 'slow_mover';
    return 'stable';
}

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const AnalyticsQuery = extendType({
    type: 'Query',
    definition(t) {

        // ── getSalesAnalytics ──────────────────────────────────────────────────────
        t.nonNull.field('getSalesAnalytics', {
            type: 'SalesAnalyticsPayload',
            args: {
                preset: nonNull('DateRangePreset' as any),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
            },
            async resolve(_, { preset, startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);
                const orgId = Number(ctx.user.orgId)
                const { currentStart, currentEnd, prevStart, prevEnd } =
                    resolveDateWindow(preset, startDate, endDate);

                // Fetch all transactions in both windows for this org's outlets
                const [currentTx, prevTx, branches] = await Promise.all([
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: { in: ["PAID", "SYNCED"] },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { include: { branch: true } },
                        },
                    }),
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: { in: ["PAID", "SYNCED"] },
                        },
                        select: { total: true, outletId: true, outlet: { select: { branchId: true } } },
                    }),
                    ctx.prisma.branch.findMany({
                        where: { orgId, isActive: true },
                        include: { outlets: true },
                    }),
                ]);

                // ── Summary ────────────────────────────────────────────────────────────
                const totalRevenue = currentTx.reduce((s, t) => s + Number(t.total ?? 0), 0);
                const prevRevenue = prevTx.reduce((s, t) => s + Number(t.total ?? 0), 0);

                // Cost = sum of (CartItem.quantity * Item.totalCost)
                let totalCost = 0;
                let totalItemsSold = 0;
                for (const tx of currentTx) {
                    for (const ci of tx.items) {
                        const qty = Number(ci.quantity ?? 0);
                        const cost = Number(ci.item?.totalCost ?? 0);
                        totalCost += qty * cost;
                        totalItemsSold += qty;
                    }
                }
                const grossProfit = totalRevenue - totalCost;
                const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

                // Previous period cost for delta
                let prevCost = 0;
                for (const tx of prevTx as any[]) {
                    // Simplified: use same cost ratio estimate (full join too expensive)
                    prevCost += Number((tx as any).total ?? 0) * (totalRevenue > 0 ? totalCost / totalRevenue : 0);
                }
                const prevGrossProfit = prevRevenue - prevCost;

                // ── Branch performance ─────────────────────────────────────────────────
                const branchPerformance: BranchPerformance[] = [];
                let profitableBranches = 0;

                for (const branch of branches) {
                    const branchOutletIds = new Set(branch.outlets.map((o) => o.id));

                    const bCurrent = currentTx.filter((t) => branchOutletIds.has(t.outletId));
                    const bPrev = prevTx.filter((t) => branchOutletIds.has(t.outletId));

                    const bRevenue = bCurrent.reduce((s, t) => s + Number(t.total ?? 0), 0);
                    const bPrevRevenue = bPrev.reduce((s, t) => s + Number(t.total ?? 0), 0);

                    let bCost = 0;
                    for (const tx of bCurrent) {
                        for (const ci of tx.items) {
                            bCost += Number(ci.quantity ?? 0) * Number(ci.item?.totalCost ?? 0);
                        }
                    }
                    const bProfit = bRevenue - bCost;
                    const bMargin = bRevenue > 0 ? (bProfit / bRevenue) * 100 : 0;
                    const bPrevCost = bPrevRevenue * (bRevenue > 0 ? bCost / bRevenue : 0);
                    const bPrevProfit = bPrevRevenue - bPrevCost;

                    if (bProfit > 0) profitableBranches++;

                    branchPerformance.push({
                        branchId: branch.id,
                        branchName: branch.name,
                        totalRevenue: bRevenue,
                        totalCost: bCost,
                        grossProfit: bProfit,
                        profitMargin: bMargin,
                        totalOrders: bCurrent.length,
                        deltaRevenue: delta(bRevenue, bPrevRevenue),
                        deltaProfit: delta(bProfit, bPrevProfit),
                        isProfitable: bProfit > 0,
                        trend: buildSparkline(bCurrent, currentStart, currentEnd),
                    });
                }

                // ── Item performance ──────────────────────────────────────────────────
                const itemMap: Record<
                    number,
                    {
                        itemId: number;
                        itemName: string;
                        itemImage?: string;
                        categoryName?: string;
                        revenue: number;
                        cost: number;
                        units: number;
                    }
                > = {};

                for (const tx of currentTx) {
                    for (const ci of tx.items) {
                        const id = ci.itemId;
                        const qty = Number(ci.quantity ?? 0);
                        // Use InventoryItems price if available, fall back to item.sellingPrice
                        const price = Number((ci.item as any)?.sellingPrice ?? 0);
                        const cost = Number(ci.item?.totalCost ?? 0);

                        if (!itemMap[id]) {
                            itemMap[id] = {
                                itemId: id,
                                itemName: ci.item?.name ?? `Item #${id}`,
                                itemImage: ci.item?.image ?? undefined,
                                categoryName: (ci.item as any)?.orgCategory?.name ?? undefined,
                                revenue: 0,
                                cost: 0,
                                units: 0,
                            };
                        }
                        itemMap[id].revenue += qty * price;
                        itemMap[id].cost += qty * cost;
                        itemMap[id].units += qty;
                    }
                }

                // Previous period units for trend %
                const prevItemUnits: Record<number, number> = {};
                for (const tx of prevTx as any[]) {
                    for (const ci of (tx as any).items ?? []) {
                        const id = ci.itemId;
                        prevItemUnits[id] = (prevItemUnits[id] ?? 0) + Number(ci.quantity ?? 0);
                    }
                }

                const allItems = Object.values(itemMap);
                allItems.sort((a, b) => b.revenue - a.revenue);
                const total = allItems.length;

                const toItemPerf = (
                    item: (typeof allItems)[0],
                    rank: number,
                ): ItemPerformance => {
                    const profit = item.revenue - item.cost;
                    const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
                    const prevUnits = prevItemUnits[item.itemId] ?? 0;
                    const trendPct = delta(item.units, prevUnits);
                    const trendDir: 'up' | 'down' | 'stable' =
                        trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'stable';

                    return {
                        itemId: item.itemId,
                        itemName: item.itemName,
                        itemImage: item.itemImage,
                        categoryName: item.categoryName,
                        totalRevenue: item.revenue,
                        totalCost: item.cost,
                        grossProfit: profit,
                        profitMargin: margin,
                        unitsSold: item.units,
                        revenuePerUnit: item.units > 0 ? item.revenue / item.units : 0,
                        trend: trendDir,
                        trendPct,
                        status: classifyItem(margin, trendPct, rank, total),
                    };
                };

                const topItems = allItems.slice(0, 10).map((item, i) => toItemPerf(item, i + 1));
                // Bottom items = worst by grossProfit (loss items first, then lowest margin)
                const bottomItems = [...allItems]
                    .sort((a, b) => a.revenue - a.cost - (b.revenue - b.cost))
                    .slice(0, 10)
                    .map((item, i) => toItemPerf(item, total - i));

                // ── Trend (time series) ────────────────────────────────────────────────
                const trend = buildTrendSeries(currentTx, currentStart, currentEnd, preset);

                return {
                    summary: {
                        totalRevenue,
                        totalCost,
                        grossProfit,
                        profitMargin,
                        totalOrders: currentTx.length,
                        totalItemsSold,
                        revenueChange: delta(totalRevenue, prevRevenue),
                        profitChange: delta(grossProfit, prevGrossProfit),
                        profitableBranches,
                        totalBranches: branches.length,
                    },
                    branches: branchPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue),
                    topItems,
                    bottomItems,
                    trend,
                };
            },
        });

        // ── getBranchAnalytics ─────────────────────────────────────────────────────
        t.nonNull.field('getBranchAnalytics', {
            type: 'BranchAnalyticsPayload',
            args: {
                branchId: nonNull(intArg()),
                preset: nonNull('DateRangePreset' as any),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
            },
            async resolve(_, { branchId, preset, startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);

                const { currentStart, currentEnd, prevStart, prevEnd } =
                    resolveDateWindow(preset, startDate, endDate);

                const branch = await ctx.prisma.branch.findUnique({
                    where: { id: branchId },
                    include: { outlets: true },
                });
                if (!branch) throw new Error('Branch not found');

                const outletIds = branch.outlets.map((o) => o.id);

                const [currentTx, prevTx] = await Promise.all([
                    ctx.prisma.transaction.findMany({
                        where: {
                            outletId: { in: outletIds },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: { in: ["PAID", "SYNCED"] },
                        },
                        include: { items: { include: { item: true } } },
                    }),
                    ctx.prisma.transaction.findMany({
                        where: {
                            outletId: { in: outletIds },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: { in: ["PAID", "SYNCED"] },
                        },
                        select: { total: true },
                    }),
                ]);

                const revenue = currentTx.reduce((s, t) => s + Number(t.total ?? 0), 0);
                const prevRevenue = prevTx.reduce((s, t) => s + Number(t.total ?? 0), 0);
                let cost = 0;
                for (const tx of currentTx) {
                    for (const ci of tx.items) {
                        cost += Number(ci.quantity ?? 0) * Number(ci.item?.totalCost ?? 0);
                    }
                }
                const profit = revenue - cost;
                const prevCost = prevRevenue * (revenue > 0 ? cost / revenue : 0);
                const prevProfit = prevRevenue - prevCost;

                const branchResult: BranchPerformance = {
                    branchId: branch.id,
                    branchName: branch.name,
                    totalRevenue: revenue,
                    totalCost: cost,
                    grossProfit: profit,
                    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
                    totalOrders: currentTx.length,
                    deltaRevenue: delta(revenue, prevRevenue),
                    deltaProfit: delta(profit, prevProfit),
                    isProfitable: profit > 0,
                    trend: buildSparkline(currentTx, currentStart, currentEnd),
                };

                return {
                    branch: branchResult,
                    trend: buildTrendSeries(currentTx, currentStart, currentEnd, preset),
                };
            },
        });

        // ── getItemAnalytics ───────────────────────────────────────────────────────
        t.nonNull.field('getItemAnalytics', {
            type: 'ItemAnalyticsPayload',
            args: {

                preset: nonNull('DateRangePreset' as any),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
                limit: nullable(intArg()),
            },
            async resolve(_, { preset, startDate, endDate, limit = 20 }, ctx) {

                const orgId = Number(ctx.user.orgId)
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);

                const { currentStart, currentEnd, prevStart, prevEnd } =
                    resolveDateWindow(preset, startDate, endDate);

                const [currentTx, prevTx] = await Promise.all([
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: { in: ["PAID", "SYNCED"]},
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                        },
                    }),
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: { in: ["PAID", "SYNCED"]},
                        },
                        include: { items: { select: { itemId: true, quantity: true } } },
                    }),
                ]);

                const itemMap: Record<number, any> = {};
                for (const tx of currentTx) {
                    for (const ci of tx.items) {
                        const id = ci.itemId;
                        const qty = Number(ci.quantity ?? 0);
                        const price = Number((ci.item as any)?.sellingPrice ?? 0);
                        const cost = Number(ci.item?.totalCost ?? 0);
                        if (!itemMap[id]) {
                            itemMap[id] = {
                                itemId: id,
                                itemName: ci.item?.name ?? `Item #${id}`,
                                itemImage: ci.item?.image,
                                categoryName: (ci.item as any)?.orgCategory?.name,
                                revenue: 0, cost: 0, units: 0,
                            };
                        }
                        itemMap[id].revenue += qty * price;
                        itemMap[id].cost += qty * cost;
                        itemMap[id].units += qty;
                    }
                }

                const prevUnits: Record<number, number> = {};
                for (const tx of prevTx) {
                    for (const ci of tx.items) {
                        prevUnits[ci.itemId] = (prevUnits[ci.itemId] ?? 0) + Number(ci.quantity ?? 0);
                    }
                }

                const all = Object.values(itemMap);
                all.sort((a, b) => b.revenue - a.revenue);
                const total = all.length;

                const toPerf = (item: any, rank: number): ItemPerformance => {
                    const profit = item.revenue - item.cost;
                    const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
                    const trendPct = delta(item.units, prevUnits[item.itemId] ?? 0);
                    return {
                        itemId: item.itemId,
                        itemName: item.itemName,
                        itemImage: item.itemImage,
                        categoryName: item.categoryName,
                        totalRevenue: item.revenue,
                        totalCost: item.cost,
                        grossProfit: profit,
                        profitMargin: margin,
                        unitsSold: item.units,
                        revenuePerUnit: item.units > 0 ? item.revenue / item.units : 0,
                        trend: trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'stable',
                        trendPct,
                        status: classifyItem(margin, trendPct, rank, total),
                    };
                };

                return {
                    topItems: all.slice(0, limit ?? 20).map((item, i) => toPerf(item, i + 1)),
                    bottomItems: [...all]
                        .sort((a, b) => (a.revenue - a.cost) - (b.revenue - b.cost))
                        .slice(0, limit ?? 20)
                        .map((item, i) => toPerf(item, total - i)),
                };
            },
        });
    },
});

// ─── Trend series builder ─────────────────────────────────────────────────────

function buildTrendSeries(
    transactions: any[],
    start: Date,
    end: Date,
    preset: string,
): SalesTrendPoint[] {
    // Determine bucket size based on preset
    const useHours = preset === 'today';
    const useWeekDays = preset === 'this_week';

    if (useHours) {
        // 24 hourly buckets
        const buckets: Record<string, { revenue: number; cost: number; orders: number }> = {};
        for (let h = 0; h < 24; h++) {
            const label = `${String(h).padStart(2, '0')}:00`;
            buckets[label] = { revenue: 0, cost: 0, orders: 0 };
        }
        for (const tx of transactions) {
            const h = new Date(tx.createdAt).getHours();
            const label = `${String(h).padStart(2, '0')}:00`;
            buckets[label].revenue += Number(tx.total ?? 0);
            let txCost = 0;
            for (const ci of tx.items ?? []) {
                txCost += Number(ci.quantity ?? 0) * Number(ci.item?.totalCost ?? 0);
            }
            buckets[label].cost += txCost;
            buckets[label].orders += 1;
        }
        return Object.entries(buckets).map(([label, v]) => ({
            label,
            revenue: v.revenue,
            cost: v.cost,
            profit: v.revenue - v.cost,
            orders: v.orders,
        }));
    }

    if (useWeekDays) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const buckets: Record<string, { revenue: number; cost: number; orders: number }> = {};
        days.forEach((d) => (buckets[d] = { revenue: 0, cost: 0, orders: 0 }));
        for (const tx of transactions) {
            const d = days[new Date(tx.createdAt).getDay()];
            buckets[d].revenue += Number(tx.total ?? 0);
            let txCost = 0;
            for (const ci of tx.items ?? []) {
                txCost += Number(ci.quantity ?? 0) * Number(ci.item?.totalCost ?? 0);
            }
            buckets[d].cost += txCost;
            buckets[d].orders += 1;
        }
        return days.map((d) => ({
            label: d,
            revenue: buckets[d].revenue,
            cost: buckets[d].cost,
            profit: buckets[d].revenue - buckets[d].cost,
            orders: buckets[d].orders,
        }));
    }

    // Default: bucket by date (day-level)
    const buckets: Record<string, { revenue: number; cost: number; orders: number }> = {};
    const cursor = new Date(start);
    while (cursor <= end) {
        const label = cursor.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        buckets[label] = { revenue: 0, cost: 0, orders: 0 };
        cursor.setDate(cursor.getDate() + 1);
    }
    for (const tx of transactions) {
        const label = new Date(tx.createdAt).toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
        });
        if (buckets[label]) {
            buckets[label].revenue += Number(tx.total ?? 0);
            let txCost = 0;
            for (const ci of tx.items ?? []) {
                txCost += Number(ci.quantity ?? 0) * Number(ci.item?.totalCost ?? 0);
            }
            buckets[label].cost += txCost;
            buckets[label].orders += 1;
        }
    }
    return Object.entries(buckets).map(([label, v]) => ({
        label,
        revenue: v.revenue,
        cost: v.cost,
        profit: v.revenue - v.cost,
        orders: v.orders,
    }));
}

// Re-export types for use in service
interface BranchPerformance {
    branchId: number; branchName: string; totalRevenue: number; totalCost: number;
    grossProfit: number; profitMargin: number; totalOrders: number;
    deltaRevenue: number; deltaProfit: number; isProfitable: boolean; trend: number[];
}
interface ItemPerformance {
    itemId: number; itemName: string; itemImage?: string; categoryName?: string;
    totalRevenue: number; totalCost: number; grossProfit: number; profitMargin: number;
    unitsSold: number; revenuePerUnit: number;
    trend: 'up' | 'down' | 'stable'; trendPct: number;
    status: 'top_seller' | 'stable' | 'slow_mover' | 'loss_item';
}
interface SalesTrendPoint {
    label: string; revenue: number; cost: number; profit: number; orders: number;
}