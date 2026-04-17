import { extendType, intArg, stringArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
export const accountTitleMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createAccountTitle', {
            type: 'AccountTitle',
            args: {
                name: stringArg(),
                code: stringArg()
            },
            resolve: async (_, { name, code }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                const orgId = Number(ctx.user?.orgId);
                return ctx.prisma.accountTitle.create({
                    data: { orgId, name, code }
                });
            }
        });
        t.field('updateAccountTitle', {
            type: 'AccountTitle',
            args: {
                id: intArg(),
                name: stringArg(),
                code: stringArg()
            },
            resolve: async (_, { id, name, code }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                const orgId = Number(ctx.user?.orgId);
                return ctx.prisma.accountTitle.update({
                    where: { id, orgId },
                    data: { name, code }
                });
            }
        });
        t.field('deleteAccountTitle', {
            type: 'AccountTitle',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireRole(ctx, ['OWNER']);
                return ctx.prisma.accountTitle.delete({
                    where: { id }
                });
            }
        });
    }
});
