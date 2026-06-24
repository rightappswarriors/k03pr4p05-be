import { extendType, intArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
export const departmentQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('departments', {
            type: 'Department',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.view(ctx);
                return ctx.prisma.department.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('department', {
            type: 'Department',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.view(ctx);
                return ctx.prisma.department.findUnique({
                    where: { id }
                });
            }
        });
    }
});
