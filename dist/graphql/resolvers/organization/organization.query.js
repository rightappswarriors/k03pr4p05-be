import { extendType } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const organizationQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('organizations', {
            type: 'Organization',
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.organization.findMany();
            }
        });
        t.field('organization', {
            type: 'Organization',
            args: { id: 'Int' },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.organization.findUnique({ where: { id } });
            }
        });
    }
});
