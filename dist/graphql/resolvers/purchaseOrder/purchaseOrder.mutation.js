import { extendType, nonNull, stringArg, intArg, nullable, list, arg, inputObjectType } from 'nexus';
import { sendNewPONotificationEmail, sendPOStatusEmail } from '../../../services/email/kompraSupplier.email.js';
export const POLineItemInput = inputObjectType({
    name: 'POLineItemInput',
    definition(t) {
        t.nonNull.string('supplierItemId');
        t.nonNull.int('qty');
    },
});
function generatePONumber() {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-${datePart}-${rand}`;
}
export const PurchaseOrderMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('createPurchaseOrder', {
            type: 'PurchaseOrder',
            args: {
                supplierOrgId: nonNull(intArg()),
                buyerOrgId: nonNull(intArg()),
                outletId: nonNull(intArg()),
                notes: nullable(stringArg()),
                requestedDate: nullable(arg({ type: 'DateTime' })),
                lineItems: nonNull(list(nonNull(arg({ type: 'POLineItemInput' })))),
            },
            resolve: async (_, { supplierOrgId, buyerOrgId, outletId, notes, requestedDate, lineItems }, ctx) => {
                const poNumber = generatePONumber();
                let totalAmount = 0;
                let vatAmount = 0;
                const enrichedLines = [];
                for (const li of lineItems) {
                    const item = await ctx.prisma.supplierItem.findUniqueOrThrow({
                        where: { id: li.supplierItemId },
                        include: { priceTiers: { orderBy: { minQty: 'desc' } } },
                    });
                    let unitPrice = item.unitPrice;
                    for (const tier of item.priceTiers) {
                        if (li.qty >= tier.minQty) {
                            unitPrice = tier.price;
                            break;
                        }
                    }
                    const subtotal = unitPrice * li.qty;
                    const vat = item.isVatExempt ? 0 : subtotal * item.vatRate;
                    totalAmount += subtotal + vat;
                    vatAmount += vat;
                    enrichedLines.push({ supplierItemId: li.supplierItemId, qty: li.qty, unitPrice, subtotal });
                }
                const po = await ctx.prisma.purchaseOrder.create({
                    data: {
                        poNumber,
                        supplierOrgId,
                        buyerOrgId,
                        outletId,
                        notes,
                        requestedDate,
                        totalAmount,
                        vatAmount,
                        lineItems: { create: enrichedLines },
                    },
                    include: {
                        lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
                        delivery: true,
                        buyerOrg: true,
                        supplierOrg: true,
                        outlet: true,
                    },
                });
                const supplierUser = await ctx.prisma.user.findFirst({
                    where: { organizationId: supplierOrgId },
                    select: { email: true },
                });
                if (supplierUser?.email) {
                    sendNewPONotificationEmail(supplierUser.email, poNumber, po.buyerOrg.name, totalAmount).catch(() => { });
                }
                return po;
            },
        });
        t.nonNull.field('acceptPO', {
            type: 'PurchaseOrder',
            args: {
                id: nonNull(stringArg()),
                scheduledDate: nonNull(arg({ type: 'DateTime' })),
                driverName: nullable(stringArg()),
                driverContact: nullable(stringArg()),
            },
            resolve: async (_, { id, scheduledDate, driverName, driverContact }, ctx) => {
                const po = await ctx.prisma.purchaseOrder.update({
                    where: { id },
                    data: {
                        status: 'ACCEPTED',
                        delivery: {
                            create: {
                                scheduledDate,
                                driverName,
                                driverContact,
                                status: 'SCHEDULED',
                            },
                        },
                    },
                    include: {
                        lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
                        delivery: true,
                        buyerOrg: true,
                        supplierOrg: true,
                        outlet: true,
                    },
                });
                const buyerUser = await ctx.prisma.user.findFirst({
                    where: { organizationId: po.buyerOrgId },
                    select: { email: true },
                });
                if (buyerUser?.email) {
                    sendPOStatusEmail(buyerUser.email, po.poNumber, 'ACCEPTED').catch(() => { });
                }
                return po;
            },
        });
        t.nonNull.field('rejectPO', {
            type: 'PurchaseOrder',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (_, { id }, ctx) => {
                const po = await ctx.prisma.purchaseOrder.update({
                    where: { id },
                    data: { status: 'REJECTED' },
                    include: {
                        lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
                        delivery: true,
                        buyerOrg: true,
                        supplierOrg: true,
                        outlet: true,
                    },
                });
                const buyerUser = await ctx.prisma.user.findFirst({
                    where: { organizationId: po.buyerOrgId },
                    select: { email: true },
                });
                if (buyerUser?.email) {
                    sendPOStatusEmail(buyerUser.email, po.poNumber, 'REJECTED').catch(() => { });
                }
                return po;
            },
        });
    },
});
