import { extendType, intArg, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
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
                return ctx.prisma.department.delete({
                    where: { id }
                });
            }
        });
    }
});
