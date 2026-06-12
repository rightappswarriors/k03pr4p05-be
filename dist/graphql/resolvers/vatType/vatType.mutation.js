import { extendType, floatArg, intArg, stringArg } from 'nexus';
export const vatTypeMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createVatType', {
            type: 'VatType',
            args: {
                name: stringArg(),
                rate: floatArg()
            },
            resolve: async (_, { name, rate }, ctx) => {
                const orgId = ctx.user.orgId;
                rate = rate / 100;
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
                rate: floatArg()
            },
            resolve: async (_, { id, name, rate }, ctx) => {
                const orgId = ctx.user.orgId;
                rate = rate / 100;
                // verify ownership first
                const existing = await ctx.prisma.vatType.findFirst({ where: { id, orgId } });
                if (!existing)
                    throw new Error('VAT type not found.');
                return ctx.prisma.vatType.update({
                    where: { id }, // ✅ just id — it's the primary key
                    data: { name, rate },
                });
            },
        });
        t.field('deleteVatType', {
            type: 'VatType',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.vatType.update({
                    where: { id },
                    data: { deletedAt: new Date() },
                });
            }
        });
    }
});
