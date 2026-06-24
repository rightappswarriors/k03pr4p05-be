import { objectType, inputObjectType } from 'nexus';
export const PriceTier = objectType({
    name: 'PriceTier',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('minQty');
        t.nonNull.float('price');
    },
});
export const SupplierCatalog = objectType({
    name: 'SupplierCatalog',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('organizationId');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.list.nonNull.field('items', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => ctx.prisma.supplierItem.findMany({
                where: { catalogId: parent.id, isActive: true },
                include: { priceTiers: true },
                orderBy: { name: 'asc' },
            }),
        });
    },
});
export const SupplierItem = objectType({
    name: 'SupplierItem',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nullable.string('description');
        t.nullable.string('sku');
        t.nonNull.string('unit');
        t.nonNull.float('unitPrice');
        t.nonNull.boolean('isVatExempt');
        t.nonNull.float('vatRate');
        t.nonNull.int('moq');
        t.nonNull.int('availableQty');
        t.nonNull.boolean('isActive');
        t.nonNull.list.nonNull.field('priceTiers', {
            type: 'PriceTier',
            resolve: (parent, _, ctx) => ctx.prisma.priceTier.findMany({
                where: { supplierItemId: parent.id },
                orderBy: { minQty: 'asc' },
            }),
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
    },
});
export const PriceTierInput = inputObjectType({
    name: 'PriceTierInput',
    definition(t) {
        t.nonNull.int('minQty');
        t.nonNull.float('price');
    },
});
