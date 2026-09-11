import { extendType, nonNull, stringArg, nullable } from 'nexus';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import { requireSupplierCatalogScope, requireSupplierItemScope } from '../../../lib/supplierScope.js';
export const SupplierItemsQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nullable.field('supplierCatalog', {
            type: 'SupplierCatalog',
            resolve: async (_, __, ctx) => {
                PAGE_PERMISSIONS.supplierProducts.view(ctx);
                const organizationId = ctx.user?.orgId;
                return ctx.prisma.supplierCatalog.findUnique({
                    where: { organizationId },
                    include: { items: { where: { isActive: true }, include: { priceTiers: true } } },
                });
            },
        });
        t.nonNull.list.nonNull.field('supplierItems', {
            type: 'SupplierItem',
            args: {
                catalogId: nonNull(stringArg()),
            },
            resolve: async (_, { catalogId }, ctx) => {
                PAGE_PERMISSIONS.supplierProducts.view(ctx);
                await requireSupplierCatalogScope(ctx, catalogId);
                return ctx.prisma.supplierItem.findMany({
                    where: { catalogId, isActive: true },
                    include: { priceTiers: true },
                    orderBy: { name: 'asc' },
                });
            },
        });
        t.nullable.field('supplierItem', {
            type: 'SupplierItem',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (_, { id }, ctx) => {
                PAGE_PERMISSIONS.supplierProducts.view(ctx);
                await requireSupplierItemScope(ctx, id);
                return ctx.prisma.supplierItem.findFirst({
                    where: { id },
                    include: { priceTiers: true },
                });
            },
        });
        t.nullable.field('supplierDashboard', {
            type: 'SupplierDashboardStats',
            args: {
                period: nullable(stringArg()),
            },
            resolve: async (_, { period }, ctx) => {
                PAGE_PERMISSIONS.supplierDashboard.view(ctx);
                const supplierOrgId = Number(ctx.user?.orgId);
                if (!supplierOrgId)
                    throw new Error('Authentication required');
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
                const periodMonths = period === '30D' ? 1 : period === '3M' ? 3 : period === '12M' ? 12 : 6;
                const rangeStart = new Date(now);
                if (period === '30D')
                    rangeStart.setDate(rangeStart.getDate() - 29);
                else
                    rangeStart.setMonth(rangeStart.getMonth() - periodMonths);
                // Pull the supplier's active catalog units first — used to scope which
                // open mandates are actually relevant to them (a fuel supplier shouldn't
                // see mandates for, say, office supplies).
                const catalog = await ctx.prisma.supplierCatalog.findUnique({
                    where: { organizationId: supplierOrgId },
                    include: { items: { where: { isActive: true }, select: { unit: true } } },
                });
                const activeUnits = [...new Set((catalog?.items ?? []).map((i) => i.unit))];
                const [newPOs, pendingDeliveries, fulfilledToday, pipelinePOs, openMandatesCount, myPendingMandateOffers, myAcceptedMandateOffers, wallet, revenue, purchaseOrderCount, purchaseOrdersInProgress, deliveryCount, deliveriesInProgress, activeCatalogItemCount, inactiveCatalogItemCount, recentPurchaseOrders, recentDeliveries, notifications,] = await Promise.all([
                    ctx.prisma.purchaseOrder.count({
                        where: { supplierOrgId, status: 'PENDING' },
                    }),
                    ctx.prisma.delivery.count({
                        where: {
                            po: { supplierOrgId },
                            status: { in: ['SCHEDULED', 'IN_TRANSIT'] },
                        },
                    }),
                    ctx.prisma.purchaseOrder.count({
                        where: {
                            supplierOrgId,
                            status: 'DELIVERED',
                            updatedAt: { gte: startOfDay },
                        },
                    }),
                    ctx.prisma.purchaseOrder.findMany({
                        where: {
                            supplierOrgId,
                            status: { in: ['PENDING', 'SUPPLIER_ACCEPTED', 'ACCEPTED', 'IN_TRANSIT'] },
                        },
                        select: { totalAmount: true },
                    }),
                    activeUnits.length > 0
                        ? ctx.prisma.mandate.count({
                            where: { status: 'SEARCHING', unitType: { in: activeUnits }, deletedAt: null },
                        })
                        : Promise.resolve(0),
                    ctx.prisma.mandateOffer.count({
                        where: { supplierOrgId, status: 'PENDING', deletedAt: null },
                    }),
                    ctx.prisma.mandateOffer.count({
                        where: { supplierOrgId, status: 'ACCEPTED', deletedAt: null },
                    }),
                    ctx.prisma.wallet.findFirst({ where: { orgId: supplierOrgId, environment, deletedAt: null } }),
                    ctx.prisma.purchaseOrderSettlement.aggregate({
                        where: { supplierOrgId, environment, status: 'SETTLED', settledAt: { gte: rangeStart } },
                        _sum: { supplierNet: true },
                    }),
                    ctx.prisma.purchaseOrder.count({ where: { supplierOrgId, status: { notIn: ['REJECTED', 'CANCELLED'] } } }),
                    ctx.prisma.purchaseOrder.count({ where: { supplierOrgId, status: { in: ['SUPPLIER_ACCEPTED', 'ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'IN_TRANSIT'] } } }),
                    ctx.prisma.delivery.count({ where: { po: { supplierOrgId } } }),
                    ctx.prisma.delivery.count({ where: { po: { supplierOrgId }, status: { in: ['SCHEDULED', 'IN_TRANSIT'] } } }),
                    ctx.prisma.supplierItem.count({ where: { catalog: { organizationId: supplierOrgId }, isActive: true, deletedAt: null } }),
                    ctx.prisma.supplierItem.count({ where: { catalog: { organizationId: supplierOrgId }, isActive: false, deletedAt: null } }),
                    ctx.prisma.purchaseOrder.findMany({
                        where: { supplierOrgId }, orderBy: { createdAt: 'desc' }, take: 5,
                        select: { id: true, poNumber: true, totalAmount: true, status: true, requestedDate: true, supplierExpectedDeliveryAt: true, buyerOrg: { select: { name: true } } },
                    }),
                    ctx.prisma.delivery.findMany({
                        where: { po: { supplierOrgId } }, orderBy: { updatedAt: 'desc' }, take: 5,
                        select: { id: true, status: true, scheduledDate: true, driverName: true, po: { select: { poNumber: true, buyerOrg: { select: { name: true } } } } },
                    }),
                    ctx.prisma.notification.findMany({
                        where: { orgId: supplierOrgId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5,
                        select: { id: true, title: true, message: true, createdAt: true, isRead: true },
                    }).catch(() => []),
                ]);
                const duePayments = pipelinePOs.reduce((sum, po) => sum + po.totalAmount, 0);
                const activity = await Promise.all(Array.from({ length: period === '30D' ? 30 : periodMonths }, async (_, index) => {
                    const pointStart = new Date(rangeStart);
                    const pointEnd = new Date(rangeStart);
                    let label;
                    if (period === '30D') {
                        pointStart.setDate(rangeStart.getDate() + index);
                        pointEnd.setDate(rangeStart.getDate() + index + 1);
                        label = pointStart.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
                    }
                    else {
                        pointStart.setMonth(rangeStart.getMonth() + index);
                        pointStart.setDate(1);
                        pointEnd.setMonth(pointStart.getMonth() + 1);
                        pointEnd.setDate(1);
                        label = pointStart.toLocaleDateString('en-PH', { month: 'short' });
                    }
                    const [orderCount, deliveryCount] = await Promise.all([
                        ctx.prisma.purchaseOrder.count({ where: { supplierOrgId, createdAt: { gte: pointStart, lt: pointEnd } } }),
                        ctx.prisma.delivery.count({ where: { po: { supplierOrgId }, createdAt: { gte: pointStart, lt: pointEnd } } }),
                    ]);
                    return { period: label, orderCount, deliveryCount };
                }));
                return {
                    newPOs,
                    pendingDeliveries,
                    fulfilledToday,
                    duePayments,
                    openMandatesCount,
                    myPendingMandateOffers,
                    myAcceptedMandateOffers,
                    catalogItemCount: catalog?.items.length ?? 0,
                    walletBalance: wallet?.balance ?? 0,
                    walletHeldBalance: wallet?.heldBalance ?? 0,
                    totalRevenue: revenue._sum.supplierNet ?? 0,
                    purchaseOrderCount,
                    purchaseOrdersInProgress,
                    deliveryCount,
                    deliveriesInProgress,
                    activeCatalogItemCount,
                    inactiveCatalogItemCount,
                    orderActivity: activity,
                    recentPurchaseOrders: recentPurchaseOrders.map((po) => ({
                        ...po,
                        buyerName: po.buyerOrg?.name ?? 'Buyer',
                        deliveryDate: (po.supplierExpectedDeliveryAt ?? po.requestedDate)?.toISOString() ?? null,
                    })),
                    recentDeliveries: recentDeliveries.map((delivery) => ({
                        id: delivery.id,
                        poNumber: delivery.po.poNumber,
                        buyerName: delivery.po.buyerOrg?.name ?? 'Buyer',
                        status: delivery.status,
                        scheduledDate: delivery.scheduledDate.toISOString(),
                        driverName: delivery.driverName,
                    })),
                    notifications: notifications.map((notification) => ({ ...notification, createdAt: notification.createdAt.toISOString() })),
                };
            },
        });
    },
});
