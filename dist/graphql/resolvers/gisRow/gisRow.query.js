import { extendType, intArg } from 'nexus';
export const gisRowQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('gisRows', {
            type: 'GISRow',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.gISRow.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('gisRow', {
            type: 'GISRow',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.gISRow.findUnique({
                    where: { id }
                });
            }
        });
    }
});
