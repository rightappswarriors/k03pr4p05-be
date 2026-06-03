// src/graphql/resolvers/analytics/analytics.query.ts
// Nexus-based GraphQL queries for Sales Analytics
// Follows the same pattern as item.query.ts
// Put comments
import { extendType, nonNull, intArg, nullable, stringArg, enumType, objectType, } from 'nexus';
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
        t.nonNull.float('totalItemsSold');
        t.nonNull.float('revenueChange');
        t.nonNull.float('profitChange');
        t.nonNull.int('profitableBranches');
        t.nonNull.int('totalBranches');
    },
});
export const SourceBreakdownType = objectType({
    name: 'SourceBreakdown',
    definition(t) {
        t.nonNull.string('source');
        t.nonNull.float('totalRevenue');
        t.nonNull.float('totalCost');
        t.nonNull.float('grossProfit');
        t.nonNull.int('totalOrders');
        t.nonNull.float('unitsSold');
    },
});
export const PaginatedItemAnalyticsPayloadType = objectType({
    name: 'PaginatedItemAnalyticsPayload',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'ItemPerformance' });
        t.nonNull.int('total');
        t.nonNull.int('page');
        t.nonNull.int('totalPages');
        t.nonNull.int('take');
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
        t.nonNull.float('unitsSold');
        t.nonNull.float('revenuePerUnit');
        t.nonNull.int('posSalesCount');
        t.nonNull.float('posUnitsSold');
        t.nonNull.int('salesOrderWalkInSalesCount');
        t.nonNull.float('salesOrderWalkInUnitsSold');
        t.nonNull.int('kompraOrderCount');
        t.nonNull.float('kompraUnitsSold');
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
        t.nonNull.list.nonNull.field('sourceBreakdown', { type: 'SourceBreakdown' });
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
// ─── Dashboard Order Stats Types ─────────────────────────────────────────────
export const DashboardOrderTrendPointType = objectType({
    name: 'DashboardOrderTrendPoint',
    definition(t) {
        t.nonNull.string('period');
        t.nonNull.float('total');
    },
});
export const DashboardOrderStatusBreakdownType = objectType({
    name: 'DashboardOrderStatusBreakdown',
    definition(t) {
        t.nonNull.string('category');
        t.nonNull.int('count');
        t.nonNull.float('amount');
    },
});
export const DashboardOrderStatsType = objectType({
    name: 'DashboardOrderStats',
    definition(t) {
        t.nonNull.float('receivableSalesTotal');
        t.nonNull.int('receivableOrderCount');
        t.nonNull.float('totalSalesAmount');
        t.nonNull.int('totalSalesOrderCount');
        t.nonNull.int('processingOrders');
        t.nonNull.int('pendingOrders');
        t.nonNull.int('receivedOrders');
        t.nonNull.int('cancelledReturnedOrders');
        t.nonNull.float('salesOrderReceivableTotal');
        t.nonNull.int('salesOrderReceivableCount');
        t.nonNull.float('kompraReceivableTotal');
        t.nonNull.int('kompraReceivableCount');
        t.nonNull.float('salesOrderCompletedTotal');
        t.nonNull.int('salesOrderCompletedCount');
        t.nonNull.float('kompraCompletedTotal');
        t.nonNull.int('kompraCompletedCount');
        t.nonNull.list.nonNull.field('orderStatusBreakdown', { type: 'DashboardOrderStatusBreakdown' });
        t.nonNull.list.nonNull.field('salesTrend', { type: 'DashboardOrderTrendPoint' });
    },
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Resolve the date window from a preset or explicit start/end.
 * Returns { currentStart, currentEnd, prevStart, prevEnd } for delta calculations.
 */
function resolveDateWindow(preset, startDate, endDate) {
    const now = new Date();
    let currentStart;
    let currentEnd = new Date(now);
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
            if (!startDate || !endDate)
                throw new Error('custom preset requires startDate and endDate');
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
function buildSparkline(transactions, start, end) {
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
function delta(current, previous) {
    if (previous === 0)
        return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}
/** Classify item performance status */
function classifyItem(profitMargin, trendPct, rank, totalItems) {
    if (profitMargin < 0)
        return 'loss_item';
    if (rank <= Math.ceil(totalItems * 0.2))
        return 'top_seller';
    if (trendPct < -10)
        return 'slow_mover';
    return 'stable';
}
const SALES_ORDER_REVENUE_STATUSES = ['RECEIVED', 'COMPLETED'];
const KOMPRA_ORDER_REVENUE_STATUS = 'received';
const TRANSACTION_REVENUE_STATUSES = ['PAID', 'SYNCED', 'COMPLETED'];
function normalizeOrder(order, createdAt, source) {
    return {
        ...order,
        total: Number(order.total ?? order.grandTotal ?? 0),
        createdAt,
        source,
        branchId: order.branchId ?? order.outlet?.branchId ?? null,
        outletId: order.outletId ?? null,
        items: order.items ?? [],
    };
}
function salesOrderSource(order) {
    return order.orderMode === 'WALK_IN' ? 'sales_order_walk_in' : 'sales_order_other';
}
function lineQuantity(line) {
    return Number(line.quantity ?? 0);
}
function lineRevenue(line) {
    const qty = lineQuantity(line);
    const lineTotal = line.totalPrice ?? line.subtotal ?? line.lineTotal;
    if (lineTotal !== undefined && lineTotal !== null) {
        return Number(lineTotal);
    }
    const unitPrice = line.finalPrice ??
        line.priceAtSale ??
        line.unitPrice ??
        line.priceSnapshot ??
        line.originalPrice ??
        line.item?.sellingPrice ??
        line.inventoryItem?.price ??
        0;
    return qty * Number(unitPrice ?? 0);
}
function lineCost(line) {
    return lineQuantity(line) * Number(line.item?.totalCost ?? line.inventoryItem?.item?.totalCost ?? 0);
}
function orderCost(order) {
    return (order.items ?? []).reduce((sum, line) => sum + lineCost(line), 0);
}
function orderBelongsToBranch(order, branchId, outletIds) {
    if (order.branchId === branchId || order.outlet?.branchId === branchId)
        return true;
    return !!order.outletId && outletIds.has(order.outletId);
}
function addItemsToMap(itemMap, orders) {
    for (const order of orders) {
        for (const line of order.items ?? []) {
            const isCustom = !line.itemId && line.customItemName;
            const id = Number(line.itemId ?? (isCustom ? -Number(line.id ?? 0) : 0));
            if (!id)
                continue;
            if (!itemMap[id]) {
                itemMap[id] = {
                    itemId: id,
                    itemName: line.item?.name ??
                        line.inventoryItem?.item?.name ??
                        line.inventoryItem?.name ??
                        line.customItemName ??
                        `Item #${Math.abs(id)}`,
                    itemImage: line.item?.image ?? line.inventoryItem?.item?.image ?? undefined,
                    categoryName: line.item?.orgCategory?.name ??
                        line.inventoryItem?.item?.orgCategory?.name ??
                        undefined,
                    revenue: 0,
                    cost: 0,
                    units: 0,
                    posSalesCount: 0,
                    posUnitsSold: 0,
                    salesOrderWalkInSalesCount: 0,
                    salesOrderWalkInUnitsSold: 0,
                    kompraOrderCount: 0,
                    kompraUnitsSold: 0,
                    sellingPrice: Number(line.item?.sellingPrice ?? line.inventoryItem?.price ?? 0),
                    totalCost: Number(line.item?.totalCost ?? line.inventoryItem?.item?.totalCost ?? 0),
                };
            }
            itemMap[id].revenue += lineRevenue(line);
            itemMap[id].cost += lineCost(line);
            itemMap[id].units += lineQuantity(line);
            if (order.source === 'pos') {
                itemMap[id].posSalesCount += 1;
                itemMap[id].posUnitsSold += lineQuantity(line);
            }
            else if (order.source === 'sales_order_walk_in') {
                itemMap[id].salesOrderWalkInSalesCount += 1;
                itemMap[id].salesOrderWalkInUnitsSold += lineQuantity(line);
            }
            else if (order.source === 'kompra') {
                itemMap[id].kompraOrderCount += 1;
                itemMap[id].kompraUnitsSold += lineQuantity(line);
            }
        }
    }
}
function addPrevUnits(prevUnits, orders) {
    for (const order of orders) {
        for (const line of order.items ?? []) {
            const id = Number(line.itemId ?? 0);
            if (!id)
                continue;
            prevUnits[id] = (prevUnits[id] ?? 0) + lineQuantity(line);
        }
    }
}
function buildSourceBreakdown(orders) {
    const sourceOrder = [
        'pos',
        'sales_order_walk_in',
        'sales_order_other',
        'kompra',
    ];
    const buckets = sourceOrder.reduce((map, source) => {
        map[source] = {
            source,
            totalRevenue: 0,
            totalCost: 0,
            grossProfit: 0,
            totalOrders: 0,
            unitsSold: 0,
        };
        return map;
    }, {});
    for (const order of orders) {
        const bucket = buckets[order.source];
        const revenue = Number(order.total ?? 0);
        const cost = orderCost(order);
        bucket.totalRevenue += revenue;
        bucket.totalCost += cost;
        bucket.grossProfit += revenue - cost;
        bucket.totalOrders += 1;
        bucket.unitsSold += (order.items ?? []).reduce((sum, line) => sum + lineQuantity(line), 0);
    }
    return sourceOrder.map((source) => buckets[source]);
}
// ─── Query Resolvers ──────────────────────────────────────────────────────────
export const AnalyticsQuery = extendType({
    type: 'Query',
    definition(t) {
        // ── getSalesAnalytics ──────────────────────────────────────────────────────
        t.nonNull.field('getSalesAnalytics', {
            type: 'SalesAnalyticsPayload',
            args: {
                preset: nonNull('DateRangePreset'),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
            },
            async resolve(_, { preset, startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);
                const orgId = Number(ctx.user.orgId);
                const { currentStart, currentEnd, prevStart, prevEnd } = resolveDateWindow(preset, startDate, endDate);
                const [currentTx, prevTx, currentSalesOrders, prevSalesOrders, currentKompraOrders, prevKompraOrders, branches] = await Promise.all([
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        select: { total: true, createdAt: true, outletId: true, outlet: { select: { branchId: true } }, items: { select: { itemId: true, quantity: true } } },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId,
                            date: { gte: currentStart, lte: currentEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId,
                            date: { gte: prevStart, lte: prevEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        select: {
                            total: true,
                            outletId: true,
                            branchId: true,
                            orderMode: true,
                            date: true,
                            items: { select: { itemId: true, quantity: true } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        include: {
                            items: {
                                include: {
                                    item: { include: { orgCategory: true } },
                                    inventoryItem: { select: { price: true, item: { include: { orgCategory: true } } } },
                                },
                            },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        select: {
                            total: true,
                            outletId: true,
                            createdAt: true,
                            items: { select: { itemId: true, quantity: true } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.branch.findMany({
                        where: { orgId, isActive: true },
                        include: { outlets: true },
                    }),
                ]);
                const normalizedCurrentTx = currentTx.map((order) => normalizeOrder(order, order.createdAt, 'pos'));
                const normalizedPrevTx = prevTx.map((order) => normalizeOrder(order, order.createdAt, 'pos'));
                const normalizedCurrentSalesOrders = currentSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order)));
                const normalizedPrevSalesOrders = prevSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order)));
                const normalizedCurrentKompraOrders = currentKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra'));
                const normalizedPrevKompraOrders = prevKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra'));
                const allCurrentOrders = [
                    ...normalizedCurrentTx,
                    ...normalizedCurrentSalesOrders,
                    ...normalizedCurrentKompraOrders,
                ];
                const allPrevOrders = [
                    ...normalizedPrevTx,
                    ...normalizedPrevSalesOrders,
                    ...normalizedPrevKompraOrders,
                ];
                const totalRevenue = allCurrentOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
                const prevRevenue = allPrevOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
                const totalCost = allCurrentOrders.reduce((sum, order) => sum + orderCost(order), 0);
                const totalItemsSold = allCurrentOrders.reduce((sum, order) => sum +
                    (order.items ?? []).reduce((itemSum, line) => itemSum + lineQuantity(line), 0), 0);
                const grossProfit = totalRevenue - totalCost;
                const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
                const prevCost = prevRevenue * (totalRevenue > 0 ? totalCost / totalRevenue : 0);
                const prevGrossProfit = prevRevenue - prevCost;
                const branchPerformance = [];
                let profitableBranches = 0;
                for (const branch of branches) {
                    const branchOutletIds = new Set(branch.outlets.map((o) => Number(o.id)));
                    const bCurrent = allCurrentOrders.filter((order) => orderBelongsToBranch(order, branch.id, branchOutletIds));
                    const bPrev = allPrevOrders.filter((order) => orderBelongsToBranch(order, branch.id, branchOutletIds));
                    const bRevenue = bCurrent.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
                    const bPrevRevenue = bPrev.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
                    const bCost = bCurrent.reduce((sum, order) => sum + orderCost(order), 0);
                    const bProfit = bRevenue - bCost;
                    const bMargin = bRevenue > 0 ? (bProfit / bRevenue) * 100 : 0;
                    const bPrevCost = bPrevRevenue * (bRevenue > 0 ? bCost / bRevenue : 0);
                    const bPrevProfit = bPrevRevenue - bPrevCost;
                    if (bProfit > 0)
                        profitableBranches++;
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
                const itemMap = {};
                addItemsToMap(itemMap, allCurrentOrders);
                const prevItemUnits = {};
                addPrevUnits(prevItemUnits, allPrevOrders);
                const allItems = Object.values(itemMap);
                allItems.sort((a, b) => b.revenue - a.revenue);
                const total = allItems.length;
                const toItemPerf = (item, rank) => {
                    const profit = item.revenue - item.cost;
                    const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
                    const prevUnits = prevItemUnits[item.itemId] ?? 0;
                    const trendPct = delta(item.units, prevUnits);
                    const trendDir = trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'stable';
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
                        posSalesCount: item.posSalesCount ?? 0,
                        posUnitsSold: item.posUnitsSold ?? 0,
                        salesOrderWalkInSalesCount: item.salesOrderWalkInSalesCount ?? 0,
                        salesOrderWalkInUnitsSold: item.salesOrderWalkInUnitsSold ?? 0,
                        kompraOrderCount: item.kompraOrderCount ?? 0,
                        kompraUnitsSold: item.kompraUnitsSold ?? 0,
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
                const trend = buildTrendSeries(allCurrentOrders, currentStart, currentEnd, preset);
                const sourceBreakdown = buildSourceBreakdown(allCurrentOrders);
                return {
                    summary: {
                        totalRevenue,
                        totalCost,
                        grossProfit,
                        profitMargin,
                        totalOrders: allCurrentOrders.length,
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
                    sourceBreakdown,
                };
            },
        });
        // ── getBranchAnalytics ─────────────────────────────────────────────────────
        t.nonNull.field('getBranchAnalytics', {
            type: 'BranchAnalyticsPayload',
            args: {
                branchId: nonNull(intArg()),
                preset: nonNull('DateRangePreset'),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
            },
            async resolve(_, { branchId, preset, startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);
                const { currentStart, currentEnd, prevStart, prevEnd } = resolveDateWindow(preset, startDate, endDate);
                const branch = await ctx.prisma.branch.findUnique({
                    where: { id: branchId },
                    include: { outlets: true },
                });
                if (!branch)
                    throw new Error('Branch not found');
                const outletIds = branch.outlets.map((o) => o.id);
                const [currentTx, prevTx, currentSalesOrders, prevSalesOrders, currentKompraOrders, prevKompraOrders] = await Promise.all([
                    ctx.prisma.transaction.findMany({
                        where: {
                            outletId: { in: outletIds },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        include: { items: { include: { item: true } }, outlet: { select: { branchId: true } } },
                    }),
                    ctx.prisma.transaction.findMany({
                        where: {
                            outletId: { in: outletIds },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        select: { total: true, createdAt: true, outletId: true, outlet: { select: { branchId: true } } },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId: branch.orgId,
                            OR: [{ branchId }, { outletId: { in: outletIds } }],
                            date: { gte: currentStart, lte: currentEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId: branch.orgId,
                            OR: [{ branchId }, { outletId: { in: outletIds } }],
                            date: { gte: prevStart, lte: prevEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        select: { total: true, date: true, outletId: true, branchId: true, orderMode: true, outlet: { select: { branchId: true } } },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outletId: { in: outletIds },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        include: {
                            items: {
                                include: {
                                    item: { include: { orgCategory: true } },
                                    inventoryItem: { select: { price: true, item: { include: { orgCategory: true } } } },
                                },
                            },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outletId: { in: outletIds },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        select: { total: true, createdAt: true, outletId: true, outlet: { select: { branchId: true } } },
                    }),
                ]);
                const currentOrders = [
                    ...currentTx.map((order) => normalizeOrder(order, order.createdAt, 'pos')),
                    ...currentSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order))),
                    ...currentKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra')),
                ];
                const prevOrders = [
                    ...prevTx.map((order) => normalizeOrder(order, order.createdAt, 'pos')),
                    ...prevSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order))),
                    ...prevKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra')),
                ];
                const revenue = currentOrders.reduce((s, t) => s + Number(t.total ?? 0), 0);
                const prevRevenue = prevOrders.reduce((s, t) => s + Number(t.total ?? 0), 0);
                const cost = currentOrders.reduce((s, order) => s + orderCost(order), 0);
                const profit = revenue - cost;
                const prevCost = prevRevenue * (revenue > 0 ? cost / revenue : 0);
                const prevProfit = prevRevenue - prevCost;
                const branchResult = {
                    branchId: branch.id,
                    branchName: branch.name,
                    totalRevenue: revenue,
                    totalCost: cost,
                    grossProfit: profit,
                    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
                    totalOrders: currentOrders.length,
                    deltaRevenue: delta(revenue, prevRevenue),
                    deltaProfit: delta(profit, prevProfit),
                    isProfitable: profit > 0,
                    trend: buildSparkline(currentOrders, currentStart, currentEnd),
                };
                return {
                    branch: branchResult,
                    trend: buildTrendSeries(currentOrders, currentStart, currentEnd, preset),
                };
            },
        });
        // ── getItemAnalyticsPaginated ──────────────────────────────────────────────
        t.nonNull.field('getItemAnalyticsPaginated', {
            type: 'PaginatedItemAnalyticsPayload',
            args: {
                preset: nonNull('DateRangePreset'),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
                take: nullable(intArg()), // items per page, default 20
                page: nullable(intArg()), // 1-based, default 1
                search: nullable(stringArg()), // filter by name or category
                section: nullable(stringArg()), // 'top' | 'bottom', default 'top'
            },
            async resolve(_, { preset, startDate, endDate, take = 20, page = 1, search, section = 'top' }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);
                const orgId = Number(ctx.user.orgId);
                const { currentStart, currentEnd, prevStart, prevEnd } = resolveDateWindow(preset, startDate, endDate);
                const [currentTx, prevTx, currentSalesOrders, prevSalesOrders, currentKompraOrders, prevKompraOrders, orgItems] = await Promise.all([
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        include: { items: { select: { itemId: true, quantity: true } }, outlet: { select: { branchId: true } } },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId,
                            date: { gte: currentStart, lte: currentEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId,
                            date: { gte: prevStart, lte: prevEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        select: {
                            total: true,
                            outletId: true,
                            branchId: true,
                            orderMode: true,
                            date: true,
                            items: { select: { itemId: true, quantity: true } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        include: {
                            items: {
                                include: {
                                    item: { include: { orgCategory: true } },
                                    inventoryItem: { select: { price: true, item: { include: { orgCategory: true } } } },
                                },
                            },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        select: {
                            total: true,
                            outletId: true,
                            createdAt: true,
                            items: { select: { itemId: true, quantity: true } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.item.findMany({
                        where: { orgId },
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            sellingPrice: true,
                            totalCost: true,
                            orgCategory: { select: { name: true } },
                        },
                    }),
                ]);
                // ── Build item map ─────────────────────────────────────────────────
                const itemMap = {};
                for (const item of orgItems) {
                    itemMap[item.id] = {
                        itemId: item.id,
                        itemName: item.name,
                        itemImage: item.image ?? undefined,
                        categoryName: item.orgCategory?.name ?? undefined,
                        revenue: 0,
                        cost: 0,
                        units: 0,
                        posSalesCount: 0,
                        posUnitsSold: 0,
                        salesOrderWalkInSalesCount: 0,
                        salesOrderWalkInUnitsSold: 0,
                        kompraOrderCount: 0,
                        kompraUnitsSold: 0,
                        sellingPrice: Number(item.sellingPrice ?? 0),
                        totalCost: Number(item.totalCost ?? 0),
                    };
                }
                const currentOrders = [
                    ...currentTx.map((order) => normalizeOrder(order, order.createdAt, 'pos')),
                    ...currentSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order))),
                    ...currentKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra')),
                ];
                const prevOrders = [
                    ...prevTx.map((order) => normalizeOrder(order, order.createdAt, 'pos')),
                    ...prevSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order))),
                    ...prevKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra')),
                ];
                addItemsToMap(itemMap, currentOrders);
                // ── Previous period units for trend ────────────────────────────────
                const prevUnits = {};
                addPrevUnits(prevUnits, prevOrders);
                // ── Sort by section ────────────────────────────────────────────────
                let all = Object.values(itemMap);
                if (section === 'bottom') {
                    all.sort((a, b) => (a.revenue - a.cost) - (b.revenue - b.cost));
                }
                else {
                    all.sort((a, b) => b.revenue - a.revenue);
                }
                const totalAll = all.length;
                // ── Search filter ──────────────────────────────────────────────────
                if (search?.trim()) {
                    const q = search.trim().toLowerCase();
                    all = all.filter((item) => item.itemName.toLowerCase().includes(q) ||
                        (item.categoryName ?? '').toLowerCase().includes(q));
                }
                const total = all.length;
                const safeTake = Math.max(1, take ?? 20);
                const safePage = Math.max(1, page ?? 1);
                const totalPages = Math.max(1, Math.ceil(total / safeTake));
                const clampedPage = Math.min(safePage, totalPages);
                // ── Paginate ───────────────────────────────────────────────────────
                const pageSlice = all.slice((clampedPage - 1) * safeTake, clampedPage * safeTake);
                const toPerf = (item, rank) => {
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
                        posSalesCount: item.posSalesCount ?? 0,
                        posUnitsSold: item.posUnitsSold ?? 0,
                        salesOrderWalkInSalesCount: item.salesOrderWalkInSalesCount ?? 0,
                        salesOrderWalkInUnitsSold: item.salesOrderWalkInUnitsSold ?? 0,
                        kompraOrderCount: item.kompraOrderCount ?? 0,
                        kompraUnitsSold: item.kompraUnitsSold ?? 0,
                        trend: trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'stable',
                        trendPct,
                        status: classifyItem(margin, trendPct, rank, totalAll),
                    };
                };
                const startRank = (clampedPage - 1) * safeTake + 1;
                return {
                    items: pageSlice.map((item, i) => toPerf(item, startRank + i)),
                    total,
                    page: clampedPage,
                    totalPages,
                    take: safeTake,
                };
            },
        });
        // ── getItemAnalytics ───────────────────────────────────────────────────────
        t.nonNull.field('getItemAnalytics', {
            type: 'ItemAnalyticsPayload',
            args: {
                preset: nonNull('DateRangePreset'),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
                limit: nullable(intArg()),
            },
            async resolve(_, { preset, startDate, endDate, limit = 20 }, ctx) {
                const orgId = Number(ctx.user.orgId);
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);
                const { currentStart, currentEnd, prevStart, prevEnd } = resolveDateWindow(preset, startDate, endDate);
                const [currentTx, prevTx, currentSalesOrders, prevSalesOrders, currentKompraOrders, prevKompraOrders, orgItems] = await Promise.all([
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.transaction.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: { in: TRANSACTION_REVENUE_STATUSES },
                        },
                        include: { items: { select: { itemId: true, quantity: true } }, outlet: { select: { branchId: true } } },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId,
                            date: { gte: currentStart, lte: currentEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        include: {
                            items: { include: { item: { include: { orgCategory: true } } } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.salesOrder.findMany({
                        where: {
                            orgId,
                            date: { gte: prevStart, lte: prevEnd },
                            status: { in: SALES_ORDER_REVENUE_STATUSES },
                        },
                        select: {
                            total: true,
                            outletId: true,
                            branchId: true,
                            orderMode: true,
                            date: true,
                            items: { select: { itemId: true, quantity: true } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: currentStart, lte: currentEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        include: {
                            items: {
                                include: {
                                    item: { include: { orgCategory: true } },
                                    inventoryItem: { select: { price: true, item: { include: { orgCategory: true } } } },
                                },
                            },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outlet: { orgId },
                            createdAt: { gte: prevStart, lte: prevEnd },
                            status: KOMPRA_ORDER_REVENUE_STATUS,
                        },
                        select: {
                            total: true,
                            outletId: true,
                            createdAt: true,
                            items: { select: { itemId: true, quantity: true } },
                            outlet: { select: { branchId: true } },
                        },
                    }),
                    ctx.prisma.item.findMany({
                        where: { orgId },
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            sellingPrice: true,
                            totalCost: true,
                            orgCategory: { select: { name: true } },
                        },
                    }),
                ]);
                const itemMap = {};
                for (const item of orgItems) {
                    itemMap[item.id] = {
                        itemId: item.id,
                        itemName: item.name,
                        itemImage: item.image,
                        categoryName: item.orgCategory?.name,
                        revenue: 0,
                        cost: 0,
                        units: 0,
                        posSalesCount: 0,
                        posUnitsSold: 0,
                        salesOrderWalkInSalesCount: 0,
                        salesOrderWalkInUnitsSold: 0,
                        kompraOrderCount: 0,
                        kompraUnitsSold: 0,
                        sellingPrice: Number(item.sellingPrice ?? 0),
                        totalCost: Number(item.totalCost ?? 0),
                    };
                }
                const currentOrders = [
                    ...currentTx.map((order) => normalizeOrder(order, order.createdAt, 'pos')),
                    ...currentSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order))),
                    ...currentKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra')),
                ];
                const prevOrders = [
                    ...prevTx.map((order) => normalizeOrder(order, order.createdAt, 'pos')),
                    ...prevSalesOrders.map((order) => normalizeOrder(order, order.date, salesOrderSource(order))),
                    ...prevKompraOrders.map((order) => normalizeOrder(order, order.createdAt, 'kompra')),
                ];
                addItemsToMap(itemMap, currentOrders);
                const prevUnits = {};
                addPrevUnits(prevUnits, prevOrders);
                const all = Object.values(itemMap);
                all.sort((a, b) => b.revenue - a.revenue);
                const total = all.length;
                const toPerf = (item, rank) => {
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
                        posSalesCount: item.posSalesCount ?? 0,
                        posUnitsSold: item.posUnitsSold ?? 0,
                        salesOrderWalkInSalesCount: item.salesOrderWalkInSalesCount ?? 0,
                        salesOrderWalkInUnitsSold: item.salesOrderWalkInUnitsSold ?? 0,
                        kompraOrderCount: item.kompraOrderCount ?? 0,
                        kompraUnitsSold: item.kompraUnitsSold ?? 0,
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
        // ── getDashboardOrderStats ─────────────────────────────────────────────────
        t.nullable.field("getDashboardOrderStats", {
            type: "DashboardOrderStats",
            args: {
                organizationId: nullable(intArg()),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
            },
            resolve: async (_, args, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
                const orgId = args.organizationId ?? Number(ctx.user.orgId);
                const dateFilter = {};
                if (args.startDate || args.endDate) {
                    dateFilter.date = {
                        ...(args.startDate && { gte: new Date(args.startDate) }),
                        ...(args.endDate && { lte: new Date(args.endDate) }),
                    };
                }
                const where = { orgId, ...dateFilter };
                const kompraDateFilter = {};
                if (args.startDate || args.endDate) {
                    kompraDateFilter.createdAt = {
                        ...(args.startDate && { gte: new Date(args.startDate) }),
                        ...(args.endDate && { lte: new Date(args.endDate) }),
                    };
                }
                // Pull only the fields you need — keep the DB query lean
                const [allOrders, kompraCOrders] = await Promise.all([
                    ctx.prisma.salesOrder.findMany({
                        where,
                        select: { status: true, total: true, date: true },
                    }),
                    ctx.prisma.kompraCOrder.findMany({
                        where: {
                            outlet: { orgId },
                            ...kompraDateFilter,
                        },
                        select: { status: true, total: true, createdAt: true },
                    }),
                ]);
                // ── Aggregate status buckets ────────────────────────────────────────────
                const statusMap = {};
                let receivableSalesTotal = 0;
                let receivableOrderCount = 0;
                let totalSalesAmount = 0;
                let totalSalesOrderCount = 0;
                let processingOrders = 0;
                let pendingOrders = 0;
                let receivedOrders = 0;
                let cancelledReturnedOrders = 0;
                let salesOrderReceivableTotal = 0;
                let salesOrderReceivableCount = 0;
                let kompraReceivableTotal = 0;
                let kompraReceivableCount = 0;
                let salesOrderCompletedTotal = 0;
                let salesOrderCompletedCount = 0;
                let kompraCompletedTotal = 0;
                let kompraCompletedCount = 0;
                for (const order of allOrders) {
                    const s = order.status;
                    const t = Number(order.total ?? 0);
                    if (!statusMap[s])
                        statusMap[s] = { count: 0, amount: 0 };
                    statusMap[s].count += 1;
                    statusMap[s].amount += t;
                    if (s === "ORDERED") {
                        receivableSalesTotal += t;
                        receivableOrderCount += 1;
                        salesOrderReceivableTotal += t;
                        salesOrderReceivableCount += 1;
                    }
                    if (s === "PROCESSING" || s === "SHIPPED" || s === "OUT_FOR_DELIVERY" || s === "READY_FOR_PICKUP")
                        processingOrders += 1;
                    if (s === "ORDERED")
                        pendingOrders += 1;
                    if (s === "RECEIVED" || s === "COMPLETED") {
                        receivedOrders += 1;
                        totalSalesAmount += t;
                        totalSalesOrderCount += 1;
                        salesOrderCompletedTotal += t;
                        salesOrderCompletedCount += 1;
                    }
                    if (s === "CANCELLED")
                        cancelledReturnedOrders += 1;
                }
                for (const order of kompraCOrders) {
                    const s = order.status;
                    const t = Number(order.total ?? 0);
                    const category = `KOMPRA_${s.toUpperCase()}`;
                    if (!statusMap[category])
                        statusMap[category] = { count: 0, amount: 0 };
                    statusMap[category].count += 1;
                    statusMap[category].amount += t;
                    if (s === "pending" || s === "confirmed" || s === "preparing" || s === "in_delivery") {
                        receivableSalesTotal += t;
                        receivableOrderCount += 1;
                        kompraReceivableTotal += t;
                        kompraReceivableCount += 1;
                    }
                    if (s === "pending" || s === "confirmed")
                        pendingOrders += 1;
                    if (s === "preparing" || s === "in_delivery")
                        processingOrders += 1;
                    if (s === "received") {
                        receivedOrders += 1;
                        totalSalesAmount += t;
                        totalSalesOrderCount += 1;
                        kompraCompletedTotal += t;
                        kompraCompletedCount += 1;
                    }
                    if (s === "cancelled" || s === "returned")
                        cancelledReturnedOrders += 1;
                }
                const orderStatusBreakdown = Object.entries(statusMap).map(([category, { count, amount }]) => ({ category, count, amount }));
                // ── Sales trend — group by month ────────────────────────────────────────
                const trendMap = {};
                for (const order of allOrders) {
                    if (order.status !== "RECEIVED")
                        continue;
                    const d = new Date(order.date);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    trendMap[key] = (trendMap[key] ?? 0) + Number(order.total ?? 0);
                }
                for (const order of kompraCOrders) {
                    if (order.status !== "received")
                        continue;
                    const d = new Date(order.createdAt);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    trendMap[key] = (trendMap[key] ?? 0) + Number(order.total ?? 0);
                }
                const salesTrend = Object.entries(trendMap)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([period, total]) => ({ period, total }));
                return {
                    receivableSalesTotal,
                    receivableOrderCount,
                    totalSalesAmount,
                    totalSalesOrderCount,
                    processingOrders,
                    pendingOrders,
                    receivedOrders,
                    cancelledReturnedOrders,
                    salesOrderReceivableTotal,
                    salesOrderReceivableCount,
                    kompraReceivableTotal,
                    kompraReceivableCount,
                    salesOrderCompletedTotal,
                    salesOrderCompletedCount,
                    kompraCompletedTotal,
                    kompraCompletedCount,
                    orderStatusBreakdown,
                    salesTrend,
                };
            },
        });
    },
});
// ─── Trend series builder ─────────────────────────────────────────────────────
function buildTrendSeries(transactions, start, end, preset) {
    // Determine bucket size based on preset
    const useHours = preset === 'today';
    const useWeekDays = preset === 'this_week';
    if (useHours) {
        // 24 hourly buckets
        const buckets = {};
        for (let h = 0; h < 24; h++) {
            const label = `${String(h).padStart(2, '0')}:00`;
            buckets[label] = { revenue: 0, cost: 0, orders: 0 };
        }
        for (const tx of transactions) {
            const h = new Date(tx.createdAt).getHours();
            const label = `${String(h).padStart(2, '0')}:00`;
            buckets[label].revenue += Number(tx.total ?? 0);
            buckets[label].cost += orderCost(tx);
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
        const buckets = {};
        days.forEach((d) => (buckets[d] = { revenue: 0, cost: 0, orders: 0 }));
        for (const tx of transactions) {
            const d = days[new Date(tx.createdAt).getDay()];
            buckets[d].revenue += Number(tx.total ?? 0);
            buckets[d].cost += orderCost(tx);
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
    const buckets = {};
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
            buckets[label].cost += orderCost(tx);
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
