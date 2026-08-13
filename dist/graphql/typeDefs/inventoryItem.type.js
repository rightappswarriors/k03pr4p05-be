import { objectType } from 'nexus';
export const InventoryItem = objectType({
    name: 'InventoryItem',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nonNull.string('sku');
        t.nonNull.float('stock');
        t.nonNull.float('minStock');
        t.nonNull.string('category');
        t.nonNull.float('price');
        t.nonNull.boolean('lowStock');
        t.nonNull.int('orgId');
        t.nullable.int('userId');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.inventoryItem.findUnique({ where: { id: parent.id } }).org();
            }
        });
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.inventoryItem.findUnique({ where: { id: parent.id } }).user();
            }
        });
    }
});
