import { extendType, intArg, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
// backend/subcenter.mutation.ts
export const subCenterMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createSubCenter', {
            type: 'SubCenter',
            args: {
                label: stringArg(),
            },
            resolve: async (_, { label }, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user.orgId);
                return ctx.prisma.subCenter.create({
                    data: {
                        orgId,
                        label,
                    }
                });
            }
        });
        t.field('updateSubCenter', {
            type: 'SubCenter',
            args: {
                id: intArg(),
                label: stringArg(),
            },
            resolve: async (_, { id, label }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.subCenter.update({
                    where: { id },
                    data: {
                        label,
                    }
                });
            }
        });
        t.field('deleteSubCenter', {
            type: 'SubCenter',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.subCenter.delete({
                    where: { id }
                });
            }
        });
    }
});
