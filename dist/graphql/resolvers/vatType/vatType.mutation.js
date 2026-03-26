import { extendType, intArg, stringArg } from 'nexus';
export const vatTypeMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createVatType', {
            type: 'VatType',
            args: {
                orgId: intArg(),
                name: stringArg(),
                rate: intArg()
            },
            resolve: async (_, { orgId, name, rate }, ctx) => {
                return ctx.prisma.vatType.create({
                    data: { orgId, name, rate }
                });
            }
        });
        t.field('updateVatType', {
            type: 'VatType',
            args: {
                id: intArg(),
                name: stringArg(),
                rate: intArg()
            },
            resolve: async (_, { id, name, rate }, ctx) => {
                return ctx.prisma.vatType.update({
                    where: { id },
                    data: { name, rate }
                });
            }
        });
        t.field('deleteVatType', {
            type: 'VatType',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.vatType.delete({
                    where: { id }
                });
            }
        });
    }
});
