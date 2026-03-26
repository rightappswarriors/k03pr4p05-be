import { extendType, intArg, stringArg, floatArg } from 'nexus';
export const summaryRowMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createSummaryRow', {
            type: 'SummaryRow',
            args: {
                orgId: intArg(),
                accountTitleId: intArg(),
                amount: floatArg(),
                description: stringArg()
            },
            resolve: async (_, { orgId, accountTitleId, amount, description }, ctx) => {
                return ctx.prisma.summaryRow.create({
                    data: { orgId, accountTitleId, amount, description }
                });
            }
        });
        t.field('updateSummaryRow', {
            type: 'SummaryRow',
            args: {
                id: intArg(),
                accountTitleId: intArg(),
                amount: floatArg(),
                description: stringArg()
            },
            resolve: async (_, { id, accountTitleId, amount, description }, ctx) => {
                return ctx.prisma.summaryRow.update({
                    where: { id },
                    data: { accountTitleId, amount, description }
                });
            }
        });
        t.field('deleteSummaryRow', {
            type: 'SummaryRow',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.summaryRow.delete({
                    where: { id }
                });
            }
        });
    }
});
