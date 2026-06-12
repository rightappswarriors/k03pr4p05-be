import { extendType, intArg, stringArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
export const accountTitleMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createAccountTitle', {
            type: 'AccountTitle',
            args: {
                label: stringArg(), // ✅ Changed from 'name' to 'label' for consistency
                code: stringArg()
            },
            resolve: async (_, { label, code }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                const orgId = Number(ctx.user?.orgId);
                return ctx.prisma.accountTitle.create({
                    data: {
                        orgId,
                        label,
                        code: code || null // ✅ Handle undefined/null code
                    }
                });
            }
        });
        t.field('updateAccountTitle', {
            type: 'AccountTitle',
            args: {
                id: intArg(),
                label: stringArg(), // ✅ Changed from 'name' to 'label'
                code: stringArg()
            },
            resolve: async (_, { id, label, code }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                const orgId = Number(ctx.user?.orgId);
                // ✅ Verify ownership before updating
                const existing = await ctx.prisma.accountTitle.findFirst({
                    where: { id, orgId }
                });
                if (!existing) {
                    throw new Error('Account title not found or access denied');
                }
                return ctx.prisma.accountTitle.update({
                    where: { id },
                    data: {
                        label,
                        code: code || null
                    }
                });
            }
        });
        t.field('deleteAccountTitle', {
            type: 'AccountTitle',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx); // ✅ Added auth check
                requireRole(ctx, ['OWNER']);
                const orgId = Number(ctx.user?.orgId);
                // ✅ Verify ownership before deleting
                const existing = await ctx.prisma.accountTitle.findFirst({
                    where: { id, orgId }
                });
                if (!existing) {
                    throw new Error('Account title not found or access denied');
                }
                return ctx.prisma.accountTitle.update({
                    where: { id },
                    data: { deletedAt: new Date() },
                });
            }
        });
    }
});
