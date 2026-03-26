import { extendType, intArg } from 'nexus';
export const inventoryItemQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('inventoryItems', {
            type: 'InventoryItem',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.inventoryItem.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('inventoryItem', {
            type: 'InventoryItem',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.inventoryItem.findUnique({
                    where: { id }
                });
            }
        });
    }
});
