import { extendType, intArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const gisRowQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('gisRows', {
            type: 'GISRow',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.gISRow.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('gisRow', {
            type: 'GISRow',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.gISRow.findUnique({
                    where: { id }
                });
            }
        });
    }
});
