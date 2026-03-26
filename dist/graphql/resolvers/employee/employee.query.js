import { extendType, intArg } from 'nexus';
export const employeeQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('employees', {
            type: 'Employee',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
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
                return ctx.prisma.employee.findUnique({
                    where: { id }
                });
            }
        });
    }
});
