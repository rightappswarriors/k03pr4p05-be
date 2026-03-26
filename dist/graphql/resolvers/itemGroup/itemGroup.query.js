import { extendType, intArg } from 'nexus';
export const itemGroupQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('itemGroups', {
            type: 'ItemGroup',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.itemGroup.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('itemGroup', {
            type: 'ItemGroup',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.itemGroup.findUnique({
                    where: { id }
                });
            }
        });
    }
});
