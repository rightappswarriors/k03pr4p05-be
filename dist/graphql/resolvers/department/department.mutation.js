import { extendType, intArg, stringArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
export const departmentMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createDepartment', {
            type: 'Department',
            args: {
                orgId: intArg(),
                name: stringArg()
            },
            resolve: async (_, { orgId, name }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.create(ctx);
                return ctx.prisma.department.create({
                    data: { orgId, name }
                });
            }
        });
        t.field('updateDepartment', {
            type: 'Department',
            args: {
                id: intArg(),
                name: stringArg()
            },
            resolve: async (_, { id, name }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.edit(ctx);
                return ctx.prisma.department.update({
                    where: { id },
                    data: { name }
                });
            }
        });
        t.field('deleteDepartment', {
            type: 'Department',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.delete(ctx);
                return ctx.prisma.department.update({
                    where: { id },
                    data: { deletedAt: new Date() },
                });
            }
        });
    }
});
