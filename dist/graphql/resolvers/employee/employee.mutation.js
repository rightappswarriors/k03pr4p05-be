import { extendType, intArg, stringArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
export const employeeMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createEmployee', {
            type: 'Employee',
            args: {
                orgId: intArg(),
                name: stringArg(),
                positionId: intArg(),
                departmentId: intArg()
            },
            resolve: async (_, { orgId, name, positionId, departmentId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.create(ctx);
                return ctx.prisma.employee.create({
                    data: { orgId, name, positionId, departmentId }
                });
            }
        });
        t.field('updateEmployee', {
            type: 'Employee',
            args: {
                id: intArg(),
                name: stringArg(),
                positionId: intArg(),
                departmentId: intArg()
            },
            resolve: async (_, { id, name, positionId, departmentId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.edit(ctx);
                return ctx.prisma.employee.update({
                    where: { id },
                    data: { name, positionId, departmentId }
                });
            }
        });
        t.field('deleteEmployee', {
            type: 'Employee',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.delete(ctx);
                return ctx.prisma.employee.update({
                    where: { id },
                    data: { deletedAt: new Date() },
                });
            }
        });
    }
});
