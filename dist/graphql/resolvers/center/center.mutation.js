import { extendType, intArg, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const centerMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createCenter', {
            type: 'Center',
            args: {
                orgId: intArg(),
                name: stringArg()
            },
            resolve: async (_, { orgId, name }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.center.create({
                    data: { orgId, name }
                });
            }
        });
        t.field('updateCenter', {
            type: 'Center',
            args: {
                id: intArg(),
                name: stringArg()
            },
            resolve: async (_, { id, name }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.center.update({
                    where: { id },
                    data: { name }
                });
            }
        });
        t.field('deleteCenter', {
            type: 'Center',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.center.delete({
                    where: { id }
                });
            }
        });
    }
});
