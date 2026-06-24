import { objectType } from 'nexus';
export const ReceivedItemMap = objectType({
    name: 'ReceivedItemMap',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => ctx.prisma.supplierItem.findUniqueOrThrow({
                where: { id: parent.supplierItemId },
                include: { priceTiers: true },
            }),
        });
        t.nonNull.field('item', {
            type: 'Item',
            resolve: (parent, _, ctx) => ctx.prisma.item.findUniqueOrThrow({ where: { id: parent.itemId } }),
        });
        t.nullable.field('outlet', {
            type: 'Outlet',
            resolve: (parent, _, ctx) => parent.outletId
                ? ctx.prisma.outlet.findUnique({ where: { id: parent.outletId } })
                : null,
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
    },
});
