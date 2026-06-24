import { extendType, intArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
export const vatTypeQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('vatTypes', {
            type: 'VatType',
            resolve: async (_, {}, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["OWNER", "STAFF"]);
                const orgId = ctx.user.orgId;
                return ctx.prisma.vatType.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('vatType', {
            type: 'VatType',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                const orgId = ctx.user.orgId;
                return ctx.prisma.vatType.findUnique({
                    where: { id, orgId }
                });
            }
        });
    }
});
