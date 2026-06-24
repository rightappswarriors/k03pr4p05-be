import { extendType, nonNull, stringArg, intArg } from 'nexus';
export const SupplierItemQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nullable.field('supplierCatalog', {
            type: 'SupplierCatalog',
            args: {
                organizationId: nonNull(intArg()),
            },
            resolve: async (_, { organizationId }, ctx) => {
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
                return ctx.prisma.supplierItem.findUnique({
                    where: { id },
                    include: { priceTiers: true },
                });
            },
        });
        t.nullable.field('supplierDashboard', {
            type: 'SupplierDashboardStats',
            args: {
                supplierOrgId: nonNull(intArg()),
            },
            resolve: async (_, { supplierOrgId }, ctx) => {
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const [newPOs, pendingDeliveries, fulfilledToday, deliveredPOs] = await Promise.all([
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
                            status: { in: ['PENDING', 'ACCEPTED', 'IN_TRANSIT'] },
                        },
                        select: { totalAmount: true },
                    }),
                ]);
                const duePayments = deliveredPOs.reduce((sum, po) => sum + po.totalAmount, 0);
                return { newPOs, pendingDeliveries, fulfilledToday, duePayments };
            },
        });
    },
});
