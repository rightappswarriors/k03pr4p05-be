import { objectType } from 'nexus';
export const POLineItem = objectType({
    name: 'POLineItem',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('qty');
        t.nonNull.float('unitPrice');
        t.nonNull.float('subtotal');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => ctx.prisma.supplierItem.findUniqueOrThrow({
                where: { id: parent.supplierItemId },
                include: { priceTiers: true },
            }),
        });
    },
});
export const PurchaseOrder = objectType({
    name: 'PurchaseOrder',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('poNumber');
        t.nonNull.field('status', { type: 'POStatus' });
        t.nonNull.float('totalAmount');
        t.nonNull.float('vatAmount');
        t.nullable.string('notes');
        t.nullable.field('requestedDate', { type: 'DateTime' });
        t.nonNull.field('buyerOrg', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.organization.findUniqueOrThrow({ where: { id: parent.buyerOrgId } }),
        });
        t.nonNull.field('supplierOrg', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.organization.findUniqueOrThrow({ where: { id: parent.supplierOrgId } }),
        });
        t.nonNull.field('outlet', {
            type: 'Outlet',
            resolve: (parent, _, ctx) => ctx.prisma.outlet.findUniqueOrThrow({ where: { id: parent.deliveryOutletId } }),
        });
        t.nonNull.list.nonNull.field('lineItems', {
            type: 'POLineItem',
            resolve: (parent, _, ctx) => ctx.prisma.pOLineItem.findMany({
                where: { poId: parent.id },
                include: { supplierItem: { include: { priceTiers: true } } },
            }),
        });
        t.nullable.field('delivery', {
            type: 'Delivery',
            resolve: (parent, _, ctx) => ctx.prisma.delivery.findUnique({ where: { poId: parent.id } }),
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
    },
});