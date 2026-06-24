import { objectType } from 'nexus';
export const Delivery = objectType({
    name: 'Delivery',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('status', { type: 'DeliveryStatus' });
        t.nonNull.field('scheduledDate', { type: 'DateTime' });
        t.nullable.field('deliveredAt', { type: 'DateTime' });
        t.nullable.string('driverName');
        t.nullable.string('driverContact');
        t.nullable.string('notes');
        t.nonNull.field('po', {
            type: 'PurchaseOrder',
            resolve: (parent, _, ctx) => ctx.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: parent.poId } }),
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
    },
});