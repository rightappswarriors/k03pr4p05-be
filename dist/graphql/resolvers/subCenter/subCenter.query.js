import { extendType, intArg } from 'nexus';
export const subCenterQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('subCenters', {
            type: 'SubCenter',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.subCenter.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('subCenter', {
            type: 'SubCenter',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.subCenter.findUnique({
                    where: { id }
                });
            }
        });
    }
});
