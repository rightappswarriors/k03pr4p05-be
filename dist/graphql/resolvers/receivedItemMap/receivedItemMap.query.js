import { extendType, nonNull, stringArg, intArg } from 'nexus';
export const ReceivedItemMapQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.list.nonNull.field('receivedItemMaps', {
            type: 'ReceivedItemMap',
            args: {
                supplierItemId: nonNull(stringArg()),
                buyerOrgId: nonNull(intArg()),
            },
            resolve: async (_, { supplierItemId, buyerOrgId }, ctx) => {
                return ctx.prisma.receivedItemMap.findMany({
                    where: { supplierItemId, buyerOrgId },
                    include: {
                        supplierItem: { include: { priceTiers: true } },
                        item: true,
                        outlet: true,
                    },
                });
            },
        });
    },
});
