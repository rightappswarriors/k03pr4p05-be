import { extendType, nonNull, stringArg, nullable } from 'nexus';
import { sendDeliveryConfirmationEmail } from '../../../services/email/kompraSupplier.email.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import { requireSupplierPurchaseOrderScope } from '../../../lib/supplierScope.js';
import { sendToOrg } from '../../../lib/ws.js';
import { deliveryDateNotAgreedError } from '../../../services/purchaseOrderDeliveryAgreement.service.js';
export const DeliveryMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('startDelivery', {
            type: 'Delivery',
            args: {
                poId: nonNull(stringArg()),
            },
            resolve: async (_, { poId }, ctx) => {
                PAGE_PERMISSIONS.supplierDeliveries.edit(ctx);
                await requireSupplierPurchaseOrderScope(ctx, poId);
                const delivery = await ctx.prisma.$transaction(async (tx) => {
                    await tx.$queryRaw `SELECT id FROM "PurchaseOrder" WHERE id = ${poId} FOR UPDATE`;
                    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
                    if (po.status !== 'READY_FOR_DISPATCH')
                        throw new Error('Only an order that is ready for dispatch can start delivery.');
                    if (po.source === 'DIRECT_ORDER' && po.deliveryDateAgreementStatus !== 'AGREED')
                        throw deliveryDateNotAgreedError('dispatched');
                    const cancellation = await tx.purchaseOrderCancellation.findUnique({ where: { purchaseOrderId: poId } });
                    if (cancellation?.status === 'REQUESTED')
                        throw new Error('Resolve the pending cancellation request before dispatching this order.');
                    const transitioned = await tx.purchaseOrder.updateMany({ where: { id: poId, status: 'READY_FOR_DISPATCH', ...(po.source === 'DIRECT_ORDER' ? { deliveryDateAgreementStatus: 'AGREED' } : {}) }, data: { status: 'IN_TRANSIT', dispatchedAt: new Date() } });
                    if (transitioned.count !== 1)
                        throw new Error('This order changed before delivery could start. Refresh and try again.');
                    return tx.delivery.update({ where: { poId }, data: { status: 'IN_TRANSIT' }, include: { po: true } });
                }, { isolationLevel: 'Serializable' });
                if (delivery.po.buyerOrgId)
                    sendToOrg(delivery.po.buyerOrgId, 'purchaseOrder:dispatched', { poId, poNumber: delivery.po.poNumber, status: 'IN_TRANSIT' });
                sendToOrg(delivery.po.supplierOrgId, 'purchaseOrder:dispatched', { poId, poNumber: delivery.po.poNumber, status: 'IN_TRANSIT' });
                return delivery;
            },
        });
        t.nonNull.field('markDelivered', {
            type: 'Delivery',
            args: {
                poId: nonNull(stringArg()),
                notes: nullable(stringArg()),
            },
            resolve: async (_, { poId, notes }, ctx) => {
                PAGE_PERMISSIONS.supplierDeliveries.edit(ctx);
                await requireSupplierPurchaseOrderScope(ctx, poId);
                const { delivery, buyerEmail } = await ctx.prisma.$transaction(async (tx) => {
                    await tx.$queryRaw `SELECT id FROM "PurchaseOrder" WHERE id = ${poId} FOR UPDATE`;
                    const po = await tx.purchaseOrder.findUniqueOrThrow({
                        where: { id: poId },
                        include: { lineItems: { include: { supplierItem: true } }, buyerOrg: true },
                    });
                    if (po.status !== 'IN_TRANSIT')
                        throw new Error('Only an in-transit order can be marked delivered.');
                    const transitioned = await tx.purchaseOrder.updateMany({ where: { id: poId, status: 'IN_TRANSIT' }, data: { status: 'DELIVERED' } });
                    if (transitioned.count !== 1)
                        throw new Error('This order changed before delivery could be completed. Refresh and try again.');
                    for (const li of po.lineItems) {
                        const maps = await tx.receivedItemMap.findMany({ where: { supplierItemId: li.supplierItemId, buyerOrgId: po.buyerOrgId } });
                        for (const map of maps) {
                            const updatedItem = await tx.item.update({ where: { id: map.itemId }, data: { stock: { increment: li.qty } } });
                            await tx.stockMovement.create({
                                data: {
                                    itemId: map.itemId,
                                    outletId: po.outletId,
                                    type: 'SUPPLIER_DELIVERY',
                                    quantity: li.qty,
                                    quantityBefore: updatedItem.stock - li.qty,
                                    quantityAfter: updatedItem.stock,
                                    referenceId: poId,
                                    referenceType: 'PurchaseOrder',
                                    reason: `Received via PO ${po.poNumber}`,
                                    createdBy: 0,
                                },
                            });
                        }
                    }
                    const delivery = await tx.delivery.update({ where: { poId }, data: { status: 'DELIVERED', deliveredAt: new Date(), ...(notes ? { notes } : {}) }, include: { po: true } });
                    const buyerUser = await tx.user.findFirst({ where: { organizationId: po.buyerOrgId }, select: { email: true } });
                    return { delivery, buyerEmail: buyerUser?.email ?? null };
                }, { isolationLevel: 'Serializable' });
                if (buyerEmail)
                    sendDeliveryConfirmationEmail(buyerEmail, delivery.po.poNumber).catch(() => { });
                if (delivery.po.buyerOrgId)
                    sendToOrg(delivery.po.buyerOrgId, 'purchaseOrder:delivered', { poId, poNumber: delivery.po.poNumber, status: 'DELIVERED' });
                sendToOrg(delivery.po.supplierOrgId, 'purchaseOrder:delivered', { poId, poNumber: delivery.po.poNumber, status: 'DELIVERED' });
                return delivery;
            },
        });
    },
});
