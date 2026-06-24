import { extendType, nonNull, stringArg, intArg, nullable, arg } from 'nexus';
export const PurchaseOrderQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.list.nonNull.field('purchaseOrdersForSupplier', {
            type: 'PurchaseOrder',
            args: {
                supplierOrgId: nonNull(intArg()),
                status: nullable(arg({ type: 'POStatus' })),
            },
            resolve: async (_, { supplierOrgId, status }, ctx) => {
                return ctx.prisma.purchaseOrder.findMany({
                    where: {
                        supplierOrgId,
                        ...(status ? { status } : {}),
                    },
                    include: {
                        lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
                        delivery: true,
                        buyerOrg: true,
                        outlet: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
            },
        });
        t.nonNull.list.nonNull.field('purchaseOrdersForBuyer', {
            type: 'PurchaseOrder',
            args: {
                buyerOrgId: nonNull(intArg()),
                status: nullable(arg({ type: 'POStatus' })),
            },
            resolve: async (_, { buyerOrgId, status }, ctx) => {
                return ctx.prisma.purchaseOrder.findMany({
                    where: {
                        buyerOrgId,
                        ...(status ? { status } : {}),
                    },
                    include: {
                        lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
                        delivery: true,
                        supplierOrg: true,
                        outlet: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
            },
        });
        t.nullable.field('purchaseOrder', {
            type: 'PurchaseOrder',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.purchaseOrder.findUnique({
                    where: { id },
                    include: {
                        lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
                        delivery: true,
                        buyerOrg: true,
                        supplierOrg: true,
                        outlet: true,
                    },
                });
            },
        });
    },
});
