import { extendType, intArg } from 'nexus';
export const departmentQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('departments', {
            type: 'Department',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
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
                return ctx.prisma.department.findUnique({
                    where: { id }
                });
            }
        });
    }
});
