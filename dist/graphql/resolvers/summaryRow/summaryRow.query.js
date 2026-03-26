import { extendType, intArg } from 'nexus';
export const summaryRowQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('summaryRows', {
            type: 'SummaryRow',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.summaryRow.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('summaryRow', {
            type: 'SummaryRow',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.summaryRow.findUnique({
                    where: { id }
                });
            }
        });
    }
});
