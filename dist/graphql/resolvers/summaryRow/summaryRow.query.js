import { extendType, intArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
export const summaryRowQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('summaryRows', {
            type: 'SummaryRow',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'ADMIN']);
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
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'ADMIN']);
                return ctx.prisma.summaryRow.findUnique({
                    where: { id }
                });
            }
        });
    }
});
