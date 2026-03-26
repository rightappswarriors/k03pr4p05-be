import { extendType, intArg } from 'nexus';
export const centerQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('centers', {
            type: 'Center',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.center.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('center', {
            type: 'Center',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.center.findUnique({
                    where: { id }
                });
            }
        });
    }
});
