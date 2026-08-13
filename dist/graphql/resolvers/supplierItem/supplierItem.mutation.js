import { extendType, nonNull, stringArg, intArg, floatArg, booleanArg, nullable, list, arg } from 'nexus';
export const SupplierItemMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('upsertSupplierCatalog', {
            type: 'SupplierCatalog',
            args: {
                organizationId: nonNull(intArg()),
            },
            resolve: async (_, { organizationId }, ctx) => {
                return ctx.prisma.supplierCatalog.upsert({
                    where: { organizationId },
                    create: { organizationId },
                    update: {},
                    include: { items: { include: { priceTiers: true, SupplierItemImage: true, WholesaleDocument: true,
                                WholesalePackaging: true, WholesaleShipping: true, WholesaleCustomization: true, } } },
                });
            },
        });
        t.nonNull.field('createSupplierItem', {
            type: 'SupplierItem',
            args: {
                catalogId: nonNull(stringArg()),
                name: nonNull(stringArg()),
                description: nullable(stringArg()),
                sku: nullable(stringArg()),
                unit: nonNull(stringArg()),
                unitPrice: nonNull(floatArg()),
                isVatExempt: nonNull(booleanArg()),
                vatRate: nonNull(floatArg()),
                moq: nonNull(intArg()),
                image: nullable(stringArg()),
                availableQty: nonNull(intArg()),
                priceTiers: nullable(list(nonNull(arg({ type: 'PriceTierInput' })))),
            },
            resolve: async (_, { catalogId, name, description, sku, unit, unitPrice, isVatExempt, vatRate, moq, availableQty, priceTiers }, ctx) => {
                return ctx.prisma.supplierItem.create({
                    data: {
                        catalogId,
                        name,
                        description,
                        sku,
                        unit,
                        unitPrice,
                        isVatExempt,
                        vatRate,
                        moq,
                        availableQty,
                        priceTiers: priceTiers?.length
                            ? { create: priceTiers.map((t) => ({ minQty: t.minQty, price: t.price })) }
                            : undefined,
                    },
                    include: { priceTiers: true },
                });
            },
        });
        t.nonNull.field('updateSupplierItem', {
            type: 'SupplierItem',
            args: {
                id: nonNull(stringArg()),
                name: nullable(stringArg()),
                description: nullable(stringArg()),
                sku: nullable(stringArg()),
                unit: nullable(stringArg()),
                unitPrice: nullable(floatArg()),
                isVatExempt: nullable(booleanArg()),
                vatRate: nullable(floatArg()),
                moq: nullable(intArg()),
                image: nullable(stringArg()),
                availableQty: nullable(intArg()),
                isActive: nullable(booleanArg()),
                priceTiers: nullable(list(nonNull(arg({ type: 'PriceTierInput' })))),
            },
            resolve: async (_, { id, priceTiers, ...updates }, ctx) => {
                const data = {};
                for (const [k, v] of Object.entries(updates)) {
                    if (v !== null && v !== undefined)
                        data[k] = v;
                }
                if (priceTiers !== null && priceTiers !== undefined) {
                    await ctx.prisma.priceTier.deleteMany({ where: { supplierItemId: id } });
                    data.priceTiers = { create: priceTiers.map((t) => ({ minQty: t.minQty, price: t.price })) };
                }
                return ctx.prisma.supplierItem.update({
                    where: { id },
                    data,
                    include: { priceTiers: true },
                });
            },
        });
        t.nonNull.field('deleteSupplierItem', {
            type: 'SupplierItem',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.supplierItem.update({
                    where: { id },
                    data: { isActive: false },
                    include: { priceTiers: true },
                });
            },
        });
    },
});
