import { extendType, intArg, stringArg, floatArg, nonNull } from 'nexus';
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
                centerId: nonNull(intArg()),
                subCenterId: nonNull(intArg()),
                accountTitleId: nonNull(intArg()),
                debit: floatArg(),
                credit: floatArg(),
            },
            resolve: async (_, { main, group, code, description, centerId, subCenterId, accountTitleId, debit, credit }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'ADMIN']);
                const orgId = Number(ctx.user?.orgId);
                const userId = Number(ctx.user?.id);
                const finalTotal = (credit ?? 0) - (debit ?? 0);
                return ctx.prisma.gISRow.create({
                    data: {
                        orgId,
                        userId,
                        main: main ?? 'Expenses',
                        group: group ?? 'General',
                        code: code ?? '',
                        centerId: centerId,
                        subCenterId: subCenterId,
                        accountTitleId: accountTitleId,
                        description: description ?? '',
                        debit: debit ?? 0,
                        credit: credit ?? 0,
                        total: finalTotal ?? 0,
                    },
                });
            },
        });
        t.field('updateGISRow', {
            type: 'GISRow',
            args: {
                id: nonNull(intArg()),
                main: stringArg(),
                group: stringArg(),
                code: stringArg(),
                description: stringArg(),
                accountTitleId: intArg(),
                centerId: intArg(),
                subCenterId: intArg(),
                debit: floatArg(),
                credit: floatArg(),
            },
            resolve: async (_, { id, main, group, code, description, accountTitleId, centerId, subCenterId, debit, credit }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'ADMIN']);
                const orgId = Number(ctx.user?.orgId);
                const finalTotal = (debit ?? 0) - (credit ?? 0);
                return ctx.prisma.gISRow.update({
                    where: { id, orgId },
                    data: {
                        ...(main !== undefined && { main }),
                        ...(group !== undefined && { group }),
                        ...(code !== undefined && { code }),
                        ...(description !== undefined && { description }),
                        ...(accountTitleId !== undefined && { accountTitleId }),
                        ...(centerId !== undefined && { centerId }),
                        ...(subCenterId !== undefined && { subCenterId }),
                        ...(debit !== undefined && { debit }),
                        ...(credit !== undefined && { credit }),
                        total: finalTotal,
                    },
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
