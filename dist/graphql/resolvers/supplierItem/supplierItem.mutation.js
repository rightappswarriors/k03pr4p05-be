import { extendType, nonNull, stringArg, intArg, floatArg, booleanArg, nullable, list, arg } from 'nexus';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import { requireSupplierCatalogScope, requireSupplierItemScope, requireSupplierOrganizationScope } from '../../../lib/supplierScope.js';
async function assertSelectableGlobalCategory(ctx, globalCategoryId) {
    if (!globalCategoryId)
        return;
    const category = await ctx.prisma.category.findFirst({ where: { id: globalCategoryId, status: 'ACTIVE', deletedAt: null }, select: { id: true, _count: { select: { children: { where: { status: 'ACTIVE', deletedAt: null } } } } } });
    if (!category)
        throw new Error('Selected global category is not available.');
    if (category._count.children > 0)
        throw new Error('Please choose a more specific category.');
}
export const SupplierItemMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('upsertSupplierCatalog', {
            type: 'SupplierCatalog',
            args: {
                organizationId: nonNull(intArg()),
            },
            resolve: async (_, { organizationId }, ctx) => {
                PAGE_PERMISSIONS.supplierProducts.create(ctx);
                requireSupplierOrganizationScope(ctx, organizationId);
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
                vatInclusive: nonNull(booleanArg()),
                vatRate: nonNull(floatArg()),
                moq: nonNull(intArg()),
                image: nullable(stringArg()),
                availableQty: nonNull(intArg()),
                globalCategoryId: nullable(stringArg()),
                priceTiers: nullable(list(nonNull(arg({ type: 'PriceTierInput' })))),
            },
            resolve: async (_, { catalogId, name, description, sku, unit, unitPrice, isVatExempt, vatInclusive, vatRate, moq, availableQty, globalCategoryId, priceTiers }, ctx) => {
                PAGE_PERMISSIONS.supplierProducts.create(ctx);
                await requireSupplierCatalogScope(ctx, catalogId);
                await assertSelectableGlobalCategory(ctx, globalCategoryId);
                return ctx.prisma.supplierItem.create({
                    data: {
                        catalogId,
                        name,
                        description,
                        sku,
                        unit,
                        unitPrice,
                        isVatExempt,
                        vatInclusive: isVatExempt ? false : vatInclusive,
                        vatRate,
                        moq,
                        availableQty,
                        globalCategoryId,
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
                vatInclusive: nullable(booleanArg()),
                vatRate: nullable(floatArg()),
                moq: nullable(intArg()),
                image: nullable(stringArg()),
                availableQty: nullable(intArg()),
                globalCategoryId: nullable(stringArg()),
                isActive: nullable(booleanArg()),
                priceTiers: nullable(list(nonNull(arg({ type: 'PriceTierInput' })))),
            },
            resolve: async (_, { id, priceTiers, ...updates }, ctx) => {
                PAGE_PERMISSIONS.supplierProducts.edit(ctx);
                await requireSupplierItemScope(ctx, id);
                if (updates.globalCategoryId !== undefined && updates.globalCategoryId !== null)
                    await assertSelectableGlobalCategory(ctx, updates.globalCategoryId);
                const data = {};
                for (const [k, v] of Object.entries(updates)) {
                    if (v !== null && v !== undefined)
                        data[k] = v;
                }
                if (data.isVatExempt === true)
                    data.vatInclusive = false;
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
                PAGE_PERMISSIONS.supplierProducts.delete(ctx);
                await requireSupplierItemScope(ctx, id);
                return ctx.prisma.supplierItem.update({
                    where: { id },
                    data: { isActive: false },
                    include: { priceTiers: true },
                });
            },
        });
    },
});
