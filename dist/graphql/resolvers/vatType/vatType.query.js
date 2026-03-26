import { extendType, intArg } from 'nexus';
export const vatTypeQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('vatTypes', {
            type: 'VatType',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.vatType.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('vatType', {
            type: 'VatType',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.vatType.findUnique({
                    where: { id }
                });
            }
        });
    }
});
