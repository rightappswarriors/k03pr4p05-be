import { extendType, stringArg, floatArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
export const gisRowMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createGISRow', {
            type: 'GISRow',
            args: {
                main: stringArg(),
                group: stringArg(),
                code: stringArg(),
                description: stringArg(),
                debit: floatArg(),
                credit: floatArg(),
                total: floatArg(),
            },
            resolve: async (_, { main, group, code, description, debit, credit, total }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'ADMIN']);
                const orgId = Number(ctx.user?.orgId);
                const userId = Number(ctx.user?.id);
                return ctx.prisma.gISRow.create({
                    data: {
                        orgId,
                        userId,
                        main: main ?? 'Expenses',
                        group: group ?? 'General',
                        code: code ?? '',
                        description: description ?? '',
                        debit: debit ?? 0,
                        credit: credit ?? 0,
                        total: total ?? 0,
                    },
                });
            },
        });
        t.field('updateGISRow', {
            type: 'GISRow',
            args: {
                id: stringArg(),
                main: stringArg(),
                group: stringArg(),
                code: stringArg(),
                description: stringArg(),
                debit: floatArg(),
                credit: floatArg(),
                total: floatArg(),
                amount: floatArg(),
            },
            resolve: async (_, { id, main, group, code, description, debit, credit, total }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'ADMIN']);
                const orgId = Number(ctx.user?.orgId);
                return ctx.prisma.gISRow.update({
                    where: { id, orgId },
                    data: { main, group, code, description, debit, credit, total }
                });
            }
        });
        t.field('deleteGISRow', {
            type: 'GISRow',
            args: {
                id: stringArg()
            },
            resolve: async (_, { id }, ctx) => {
                const orgId = Number(ctx.user?.orgId);
                return ctx.prisma.gISRow.delete({
                    where: { id: Number(id), orgId }
                });
            }
        });
    }
});
