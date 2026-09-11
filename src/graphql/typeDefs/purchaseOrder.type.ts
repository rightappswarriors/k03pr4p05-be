import { objectType } from 'nexus';
export const POLineItem = objectType({
    name: 'POLineItem',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('qty');
        t.nonNull.float('unitPrice');
        t.nonNull.float('subtotal');
        t.nullable.string('itemName');
        t.nullable.string('itemSku');
        t.nullable.string('itemDescription');
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
        t.nonNull.field('source', { type: 'PurchaseOrderSource' });
        t.nonNull.field('supplierConfirmation', { type: 'SupplierConfirmation' });
        t.nullable.field('supplierConfirmedAt', { type: 'DateTime' });
        t.nullable.field('supplierExpectedDeliveryAt', { type: 'DateTime' });
        t.nonNull.field('deliveryDateAgreementStatus', { type: 'DeliveryDateAgreementStatus' });
        t.nullable.field('deliveryDateAgreedAt', { type: 'DateTime' });
        t.nullable.string('supplierNote');
        t.nullable.string('rejectionReason');
        t.nonNull.float('subtotalAmount');
        t.nullable.field('extraCharges', { type: 'Json' });
        t.nonNull.float('extraChargesTotal');
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
        t.field('outlet', {
            type: 'Outlet',
            resolve: (parent, _, ctx) =>
                parent.deliveryOutletId
                    ? ctx.prisma.outlet.findUnique({ where: { id: parent.deliveryOutletId } })
                    : null,
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
        t.nullable.string('agentId');
        t.nonNull.field('paymentStatus', { type: 'PaymentStatus' });
        t.nullable.field('preparingAt', { type: 'DateTime' });
        t.nullable.string('paymentAttemptStatus', {
            resolve: (parent, _, ctx) => ctx.prisma.paymentTransaction.findFirst({
                where: { relatedType: 'PURCHASE_ORDER', relatedId: parent.id, deletedAt: null },
                orderBy: { updatedAt: 'desc' },
                select: { status: true },
            }).then((payment) => payment?.status ?? null),
        });
        t.nullable.field('receiptSnapshot', { type: 'Json' });
        t.nullable.string('conversationId');
        t.nullable.field('conversation', {
            type: 'Conversation',
            resolve: (parent, _, ctx) =>
                parent.conversationId
                    ? ctx.prisma.conversation.findUnique({ where: { id: parent.conversationId } })
                    : null,
        });
        t.nullable.field('agent', {
            type: 'Agent',
            resolve: (parent, _, ctx) =>
                parent.agentId
                    ? ctx.prisma.agent.findUnique({ where: { id: parent.agentId } })
                    : null,
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
    },
});
