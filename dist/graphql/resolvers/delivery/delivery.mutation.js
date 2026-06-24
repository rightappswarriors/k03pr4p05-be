import { extendType, nonNull, stringArg, nullable } from 'nexus';
import { sendDeliveryConfirmationEmail } from '../../../services/email/kompraSupplier.email.js';
export const DeliveryMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('startDelivery', {
            type: 'Delivery',
            args: {
                poId: nonNull(stringArg()),
            },
            resolve: async (_, { poId }, ctx) => {
                await ctx.prisma.purchaseOrder.update({
                    where: { id: poId },
                    data: { status: 'IN_TRANSIT' },
                });
                return ctx.prisma.delivery.update({
                    where: { poId },
                    data: { status: 'IN_TRANSIT' },
                    include: { po: true },
                });
            },
        });
        t.nonNull.field('markDelivered', {
            type: 'Delivery',
            args: {
                poId: nonNull(stringArg()),
                notes: nullable(stringArg()),
            },
            resolve: async (_, { poId, notes }, ctx) => {
                const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({
                    where: { id: poId },
                    include: {
                        lineItems: { include: { supplierItem: true } },
                        buyerOrg: true,
                    },
                });
                for (const li of po.lineItems) {
                    const maps = await ctx.prisma.receivedItemMap.findMany({
                        where: {
                            supplierItemId: li.supplierItemId,
                            buyerOrgId: po.buyerOrgId,
                        },
                    });
                    for (const map of maps) {
                        const item = await ctx.prisma.item.findUnique({ where: { id: map.itemId } });
                        if (!item)
                            continue;
                        const quantityBefore = item.stock;
                        const quantityAfter = quantityBefore + li.qty;
                        await ctx.prisma.item.update({
                            where: { id: map.itemId },
                            data: { stock: { increment: li.qty } },
                        });
                        await ctx.prisma.stockMovement.create({
                            data: {
                                itemId: map.itemId,
                                outletId: po.outletId,
                                type: 'SUPPLIER_DELIVERY',
                                quantity: li.qty,
                                quantityBefore,
                                quantityAfter,
                                referenceId: poId,
                                referenceType: 'PurchaseOrder',
                                reason: `Received via PO ${po.poNumber}`,
                                createdBy: 0,
                            },
                        });
                    }
                }
                await ctx.prisma.purchaseOrder.update({
                    where: { id: poId },
                    data: { status: 'DELIVERED' },
                });
                const delivery = await ctx.prisma.delivery.update({
                    where: { poId },
                    data: {
                        status: 'DELIVERED',
                        deliveredAt: new Date(),
                        ...(notes ? { notes } : {}),
                    },
                    include: { po: true },
                });
                const buyerUser = await ctx.prisma.user.findFirst({
                    where: { organizationId: po.buyerOrgId },
                    select: { email: true },
                });
                if (buyerUser?.email) {
                    sendDeliveryConfirmationEmail(buyerUser.email, po.poNumber).catch(() => { });
                }
                return delivery;
            },
        });
    },
});
