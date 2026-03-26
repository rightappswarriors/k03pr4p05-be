import { extendType, intArg } from 'nexus';
export const salesOrderQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('salesOrders', {
            type: 'SalesOrder',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.salesOrder.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('salesOrder', {
            type: 'SalesOrder',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.salesOrder.findUnique({
                    where: { id }
                });
            }
        });
    }
});
