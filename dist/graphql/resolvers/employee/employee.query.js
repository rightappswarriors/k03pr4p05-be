import { extendType, intArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const employeeQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('employees', {
            type: 'Employee',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.employee.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('employee', {
            type: 'Employee',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.employee.findUnique({
                    where: { id }
                });
            }
        });
    }
});
