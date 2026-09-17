import { createHash, randomUUID } from 'node:crypto';
import { sendToConversation } from '../lib/ws.js';
import { persistBusinessNotification, publishBusinessNotification } from './notification.service.js';
import { codMaxOrderAmountPhp, hasConfirmedDeliveryLocation, inspectPurchaseOrderFunding, isCodAmountEligible, isPurchaseOrderPaymentReady } from './purchaseOrderPolicy.service.js';
import { requireRetailerOrganization } from './supplierLink.service.js';
import { isDeliveryAgreementDeadlineExpired, reconcileExpiredDeliveryAgreement } from './purchaseOrderDeliveryAgreement.service.js';
const APPROVED_STATUSES = ['APPROVED', 'ACTIVE', 'ACCEPTED'];
export function normalizeRetailerOrderPage(page, pageSize) {
    const normalizedPage = Math.max(1, page ?? 1);
    const normalizedPageSize = pageSize ?? 20;
    if (![20, 50, 100].includes(normalizedPageSize))
        throw new Error('Page size must be 20, 50, or 100.');
    return { page: normalizedPage, pageSize: normalizedPageSize, skip: (normalizedPage - 1) * normalizedPageSize };
}
export async function requireApprovedRetailerLink(ctx, linkId) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    const link = await ctx.prisma.supplierOutletLink.findFirst({
        where: {
            id: linkId,
            deletedAt: null,
            isApproved: true,
            status: { in: APPROVED_STATUSES },
            outlet: { orgId: retailerOrgId, deletedAt: null, isActive: true },
            supplierOrg: { roles: { has: 'SUPPLIER' }, deletedAt: null, accountStatus: 'ACTIVE' },
        },
        include: { outlet: true, supplierOrg: true },
    });
    if (!link)
        throw new Error('Approved Supplier relationship not found.');
    return { link, retailerOrgId };
}
function matchingTier(quantity, tiers) {
    return [...tiers]
        .sort((left, right) => left.minQty - right.minQty)
        .find((tier) => quantity >= tier.minQty && (tier.maxQty == null || quantity <= tier.maxQty)) ?? null;
}
export function resolveRetailerLinePrice(input) {
    const variantTier = matchingTier(input.quantity, input.variantTiers ?? []);
    if (variantTier)
        return { unitPrice: variantTier.price, tier: variantTier, source: 'VARIANT_TIER' };
    if (input.variantPrice != null && input.variantPrice > 0) {
        return { unitPrice: input.variantPrice, tier: null, source: 'VARIANT_PRICE' };
    }
    const itemTier = matchingTier(input.quantity, input.itemTiers);
    if (itemTier)
        return { unitPrice: itemTier.price, tier: itemTier, source: 'ITEM_TIER' };
    if (input.itemUnitPrice > 0)
        return { unitPrice: input.itemUnitPrice, tier: null, source: 'ITEM_PRICE' };
    throw new Error('No valid price is available for this product.');
}
async function orderableItem(ctx, supplierOrgId, line) {
    if (!Number.isInteger(line.qty) || line.qty <= 0)
        throw new Error('Order quantities must be positive whole numbers.');
    const item = await ctx.prisma.supplierItem.findFirst({
        where: {
            id: line.supplierItemId,
            catalog: { organizationId: supplierOrgId },
            isActive: true,
            deletedAt: null,
            marketplaceListing: { status: 'PUBLISHED', deletedAt: null },
        },
        include: {
            priceTiers: { where: { deletedAt: null }, orderBy: { minQty: 'asc' } },
            variants: { where: { deletedAt: null, isActive: true }, include: { priceTiers: { where: { deletedAt: null }, orderBy: { minQty: 'asc' } } } },
        },
    });
    if (!item)
        throw new Error('Supplier product is no longer available.');
    if (line.qty < item.moq)
        throw new Error(`Minimum order quantity for ${item.name} is ${item.moq} ${item.unit}.`);
    const hasVariants = item.variants.length > 0;
    const variant = line.supplierItemVariantId
        ? item.variants.find((candidate) => candidate.id === line.supplierItemVariantId)
        : null;
    if (line.supplierItemVariantId && !variant)
        throw new Error('The selected product variant is no longer available.');
    if (hasVariants && !variant)
        throw new Error(`Select an exact variant for ${item.name}.`);
    const availableQty = variant ? variant.availableQty : item.availableQty;
    if (availableQty < line.qty)
        throw new Error(`Only ${availableQty} ${item.unit} of ${variant?.name ?? item.name} are currently available.`);
    const itemTiers = item.priceTiers.filter((tier) => tier.supplierItemVariantId == null);
    const price = resolveRetailerLinePrice({
        quantity: line.qty,
        itemUnitPrice: item.unitPrice,
        itemTiers,
        variantPrice: variant?.price,
        variantTiers: variant?.priceTiers ?? [],
    });
    const subtotal = Math.round(price.unitPrice * line.qty * 100) / 100;
    const vatAmount = item.isVatExempt || item.vatInclusive
        ? 0
        : Math.round(subtotal * item.vatRate * 100) / 100;
    return {
        item,
        variant,
        quantity: line.qty,
        unitPrice: price.unitPrice,
        subtotal,
        vatAmount,
        pricingSource: price.source,
        tier: price.tier,
    };
}
export async function getRetailerSupplierCatalog(ctx, input) {
    const { link } = await requireApprovedRetailerLink(ctx, input.linkId);
    const { page, pageSize, skip } = normalizeRetailerOrderPage(input.page, input.pageSize);
    const where = {
        catalog: { organizationId: link.supplierOrgId },
        isActive: true,
        deletedAt: null,
        marketplaceListing: { status: 'PUBLISHED', deletedAt: null },
        ...(input.search?.trim() ? {
            OR: [
                { name: { contains: input.search.trim(), mode: 'insensitive' } },
                { sku: { contains: input.search.trim(), mode: 'insensitive' } },
            ],
        } : {}),
    };
    const [items, total] = await Promise.all([
        ctx.prisma.supplierItem.findMany({
            where,
            include: {
                priceTiers: { where: { deletedAt: null, supplierItemVariantId: null }, orderBy: { minQty: 'asc' } },
                variants: {
                    where: { deletedAt: null, isActive: true },
                    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
                    include: { priceTiers: { where: { deletedAt: null }, orderBy: { minQty: 'asc' } } },
                },
            },
            orderBy: { name: 'asc' },
            skip,
            take: pageSize,
        }),
        ctx.prisma.supplierItem.count({ where }),
    ]);
    return {
        linkId: link.id,
        supplierOrgId: link.supplierOrgId,
        supplierName: link.supplierOrg.name,
        supplierLogo: link.supplierOrg.profileImg ?? link.supplierOrg.profilePhoto ?? null,
        supplierLocation: link.supplierOrg.location,
        supplierDescription: link.supplierOrg.bio,
        outletId: link.outletId,
        outletName: link.outlet.name,
        items,
        total,
        page,
        pageSize,
    };
}
export async function quoteRetailerOrderLine(ctx, input) {
    const { link } = await requireApprovedRetailerLink(ctx, input.linkId);
    const priced = await orderableItem(ctx, link.supplierOrgId, input);
    return {
        supplierItemId: priced.item.id,
        supplierItemVariantId: priced.variant?.id ?? null,
        itemName: priced.item.name,
        variantName: priced.variant?.name ?? null,
        sku: priced.variant?.sku ?? priced.item.sku,
        unit: priced.item.unit,
        qty: priced.quantity,
        unitPrice: priced.unitPrice,
        subtotal: priced.subtotal,
        vatAmount: priced.vatAmount,
        totalAmount: Math.round((priced.subtotal + priced.vatAmount) * 100) / 100,
        pricingSource: priced.pricingSource,
        tierMinQty: priced.tier?.minQty ?? null,
        tierMaxQty: priced.tier?.maxQty ?? null,
    };
}
export function retailerPurchaseOrderNumber(retailerOrgId, outletId, requestId) {
    const digest = createHash('sha256').update(`${retailerOrgId}:${outletId}:${requestId}`).digest('hex').slice(0, 16).toUpperCase();
    return `PO-RD-${digest}`;
}
export async function createRetailerPurchaseOrder(ctx, input) {
    const { link, retailerOrgId } = await requireApprovedRetailerLink(ctx, input.linkId);
    const requestId = input.requestId.trim();
    if (!requestId || requestId.length > 128)
        throw new Error('A valid order request identifier is required.');
    if (!input.lineItems.length)
        throw new Error('Add at least one product before submitting the order.');
    if (input.lineItems.length > 100)
        throw new Error('A purchase order cannot contain more than 100 lines.');
    const uniqueIdentity = new Set(input.lineItems.map((line) => `${line.supplierItemId}:${line.supplierItemVariantId ?? ''}`));
    if (uniqueIdentity.size !== input.lineItems.length)
        throw new Error('Combine duplicate product variants into one order line.');
    const poNumber = retailerPurchaseOrderNumber(retailerOrgId, link.outletId, requestId);
    const existing = await ctx.prisma.purchaseOrder.findUnique({ where: { poNumber } });
    if (existing) {
        if (existing.buyerOrgId !== retailerOrgId || existing.deliveryOutletId !== link.outletId || existing.supplierOrgId !== link.supplierOrgId) {
            throw new Error('This order request identifier is already in use.');
        }
        return existing;
    }
    const pricedLines = await Promise.all(input.lineItems.map((line) => orderableItem(ctx, link.supplierOrgId, line)));
    const subtotalAmount = Math.round(pricedLines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;
    const vatAmount = Math.round(pricedLines.reduce((sum, line) => sum + line.vatAmount, 0) * 100) / 100;
    const totalAmount = Math.round((subtotalAmount + vatAmount) * 100) / 100;
    try {
        let notification = null;
        const result = await ctx.prisma.$transaction(async (tx) => {
            const currentLink = await tx.supplierOutletLink.findFirst({
                where: { id: link.id, supplierOrgId: link.supplierOrgId, outletId: link.outletId, deletedAt: null, isApproved: true, status: { in: APPROVED_STATUSES } },
            });
            if (!currentLink)
                throw new Error('The Supplier relationship is no longer approved.');
            const po = await tx.purchaseOrder.create({
                data: {
                    id: randomUUID(),
                    poNumber,
                    buyerOrgId: retailerOrgId,
                    supplierOrgId: link.supplierOrgId,
                    deliveryOutletId: link.outletId,
                    source: 'DIRECT_ORDER',
                    status: 'PENDING',
                    supplierConfirmation: 'REVIEW_REQUIRED',
                    notes: input.notes?.trim() || null,
                    requestedDate: input.requestedDate ?? null,
                    subtotalAmount,
                    vatAmount,
                    extraCharges: [],
                    extraChargesTotal: 0,
                    totalAmount,
                    lineItems: {
                        create: pricedLines.map((line) => ({
                            supplierItemId: line.item.id,
                            supplierItemVariantId: line.variant?.id ?? null,
                            qty: line.quantity,
                            unitPrice: line.unitPrice,
                            subtotal: line.subtotal,
                            itemName: line.item.name,
                            itemSku: line.item.sku,
                            itemDescription: line.item.description,
                            variantName: line.variant?.name ?? null,
                            variantSku: line.variant?.sku ?? null,
                        })),
                    },
                },
            });
            const conversation = await tx.conversation.create({
                data: {
                    poId: po.id,
                    type: 'ORDER',
                    ConversationParticipant: {
                        create: [
                            { organizationId: retailerOrgId, role: 'AGENT' },
                            { organizationId: link.supplierOrgId, role: 'SUPPLIER' },
                        ],
                    },
                    ConversationMessage: {
                        create: {
                            senderOrgId: retailerOrgId,
                            type: 'ORDER_CREATED',
                            message: `Purchase Order ${po.poNumber} has been submitted for Supplier review.`,
                            metadata: { event: 'RETAILER_ORDER_CREATED', poId: po.id, poNumber: po.poNumber, outletId: link.outletId },
                        },
                    },
                },
            });
            await tx.purchaseOrder.update({ where: { id: po.id }, data: { conversationId: conversation.id } });
            const persisted = await persistBusinessNotification(tx, {
                orgId: link.supplierOrgId,
                outletId: link.outletId,
                conversationId: conversation.id,
                type: 'PURCHASE_ORDER_CREATED',
                title: 'New purchase order',
                message: `${link.outlet.name} submitted Purchase Order ${po.poNumber} for review.`,
                referenceType: 'PURCHASE_ORDER',
                referenceId: po.id,
            });
            if (persisted.created)
                notification = persisted.notification;
            await tx.auditLog.create({
                data: {
                    orgId: retailerOrgId,
                    userId: ctx.user.id,
                    pageKey: 'supplierLinksPage',
                    action: 'CREATE',
                    recordId: po.id,
                    recordType: 'PurchaseOrder',
                    newValue: { poNumber: po.poNumber, supplierOrgId: po.supplierOrgId, outletId: link.outletId, lineCount: pricedLines.length, totalAmount },
                },
            });
            return tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
        }, { isolationLevel: 'Serializable' });
        publishBusinessNotification(notification);
        return result;
    }
    catch (error) {
        if (error?.code !== 'P2002')
            throw error;
        const canonical = await ctx.prisma.purchaseOrder.findUnique({ where: { poNumber } });
        if (!canonical || canonical.buyerOrgId !== retailerOrgId)
            throw error;
        return canonical;
    }
}
export async function listRetailerPurchaseOrders(ctx, input) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    const { page, pageSize, skip } = normalizeRetailerOrderPage(input.page, input.pageSize);
    const where = { buyerOrgId: retailerOrgId, ...(input.status ? { status: input.status } : {}) };
    const [items, total] = await Promise.all([
        ctx.prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
        ctx.prisma.purchaseOrder.count({ where }),
    ]);
    return { items, total, page, pageSize };
}
export async function getRetailerPurchaseOrder(ctx, id) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    let po = await ctx.prisma.purchaseOrder.findFirst({ where: { id, buyerOrgId: retailerOrgId } });
    if (!po)
        throw new Error('Purchase order not found.');
    if (po.deliveryDateAgreementStatus === 'PENDING_BUYER' && isDeliveryAgreementDeadlineExpired(po.deliveryDateResponseDeadlineAt)) {
        await reconcileExpiredDeliveryAgreement(ctx.prisma, { purchaseOrderId: po.id });
        po = await ctx.prisma.purchaseOrder.findFirst({ where: { id, buyerOrgId: retailerOrgId } });
        if (!po)
            throw new Error('Purchase order not found.');
    }
    return po;
}
async function retailerPurchaseOrderForPayment(ctx, poId) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    let po = await ctx.prisma.purchaseOrder.findFirst({
        where: { id: poId, buyerOrgId: retailerOrgId },
        include: { delivery: true, deliveryOutlet: true },
    });
    if (!po)
        throw new Error('Purchase order not found.');
    if (po.deliveryDateAgreementStatus === 'PENDING_BUYER' && isDeliveryAgreementDeadlineExpired(po.deliveryDateResponseDeadlineAt)) {
        await reconcileExpiredDeliveryAgreement(ctx.prisma, { purchaseOrderId: po.id });
        po = await ctx.prisma.purchaseOrder.findFirst({ where: { id: poId, buyerOrgId: retailerOrgId }, include: { delivery: true, deliveryOutlet: true } });
        if (!po)
            throw new Error('Purchase order not found.');
    }
    return po;
}
export async function getRetailerPurchaseOrderPaymentEligibility(ctx, poId) {
    const po = await retailerPurchaseOrderForPayment(ctx, poId);
    const supplierAccepted = po.supplierConfirmation === 'CONFIRMED' && ['SUPPLIER_ACCEPTED', 'ACCEPTED'].includes(po.status);
    const deliveryAddressConfirmed = hasConfirmedDeliveryLocation(po.delivery);
    const deliveryDateAgreed = po.source !== 'DIRECT_ORDER' || po.deliveryDateAgreementStatus === 'AGREED';
    const paymentReady = isPurchaseOrderPaymentReady(po);
    const funding = await inspectPurchaseOrderFunding(ctx.prisma, po);
    const codMaximumAmount = codMaxOrderAmountPhp();
    return {
        poId: po.id,
        totalAmount: po.totalAmount,
        codMaximumAmount,
        supplierAccepted,
        deliveryAddressConfirmed,
        deliveryDateAgreed,
        fundingClassification: funding.classification,
        authoritativePrepaid: funding.classification === 'PREPAID_PAID',
        codEligible: paymentReady && isCodAmountEligible(po.totalAmount, codMaximumAmount),
        mayaEligible: paymentReady,
        bankTransferSupported: false,
        selectedMethod: po.paymentMethod ?? null,
    };
}
export async function confirmRetailerPurchaseOrderDeliveryLocation(ctx, input) {
    const po = await retailerPurchaseOrderForPayment(ctx, input.purchaseOrderId);
    if (po.supplierConfirmation !== 'CONFIRMED' || !['SUPPLIER_ACCEPTED', 'ACCEPTED'].includes(po.status)) {
        throw new Error('Supplier acceptance is required before confirming the delivery address.');
    }
    const address = input.address.trim();
    const instructions = input.instructions?.trim() || null;
    if (!address || address.length > 500)
        throw new Error('A valid delivery address is required.');
    if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)
        throw new Error('A valid delivery latitude is required.');
    if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)
        throw new Error('A valid delivery longitude is required.');
    if (instructions && instructions.length > 1000)
        throw new Error('Delivery instructions must not exceed 1,000 characters.');
    if (!po.delivery)
        throw new Error('The Supplier must confirm a delivery date before the delivery address can be set.');
    const unchanged = po.delivery.address === address
        && po.delivery.latitude === input.latitude
        && po.delivery.longitude === input.longitude
        && (po.delivery.notes ?? null) === instructions;
    if (unchanged)
        return po;
    let notification = null;
    let realtimeMessage = null;
    const updated = await ctx.prisma.$transaction(async (tx) => {
        await tx.delivery.update({
            where: { poId: po.id },
            data: { address, latitude: input.latitude, longitude: input.longitude, notes: instructions },
        });
        if (po.conversationId) {
            realtimeMessage = await tx.conversationMessage.create({
                data: {
                    conversationId: po.conversationId,
                    senderOrgId: po.buyerOrgId,
                    type: 'DELIVERY_SCHEDULED',
                    message: `Delivery address confirmed for Purchase Order ${po.poNumber}.`,
                    metadata: { event: 'DELIVERY_ADDRESS_CONFIRMED', poId: po.id, poNumber: po.poNumber },
                },
            });
        }
        const persisted = await persistBusinessNotification(tx, {
            orgId: po.supplierOrgId,
            outletId: po.deliveryOutletId,
            conversationId: po.conversationId,
            type: 'NEW_TRANSACTION',
            title: 'Delivery address confirmed',
            message: `The buyer confirmed the delivery address for Purchase Order ${po.poNumber}.`,
            referenceType: 'PURCHASE_ORDER',
            referenceId: po.id,
        });
        if (persisted.created)
            notification = persisted.notification;
        return tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    });
    publishBusinessNotification(notification);
    if (po.conversationId && realtimeMessage) {
        sendToConversation(po.conversationId, 'conversation:newMessage', {
            ...realtimeMessage,
            createdAt: realtimeMessage.createdAt.toISOString(),
        });
    }
    return updated;
}
export async function setRetailerPurchaseOrderPaymentMethod(ctx, poId, paymentMethod) {
    const po = await retailerPurchaseOrderForPayment(ctx, poId);
    if (!isPurchaseOrderPaymentReady(po)) {
        if (po.source === 'DIRECT_ORDER' && po.deliveryDateAgreementStatus !== 'AGREED')
            throw new Error('Agree on the delivery schedule with the Supplier before selecting a payment method.');
        throw new Error('Supplier acceptance and a confirmed delivery address are required before choosing payment.');
    }
    if (!['CASH', 'E_WALLET'].includes(paymentMethod))
        throw new Error('This payment method is not supported for Supplier Purchase Orders.');
    if (paymentMethod === 'CASH') {
        if (!isCodAmountEligible(po.totalAmount)) {
            throw new Error(`Cash on Delivery is available only for orders up to PHP ${codMaxOrderAmountPhp().toLocaleString('en-PH')}.`);
        }
        const activePayment = await ctx.prisma.paymentTransaction.findFirst({
            where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING', 'RECONCILIATION_REQUIRED'] }, deletedAt: null },
            select: { id: true },
        });
        if (activePayment)
            throw new Error('An active prepaid payment attempt already exists for this Purchase Order.');
    }
    if (po.paymentStatus === 'PAID')
        throw new Error('The payment method cannot be changed after payment confirmation.');
    return ctx.prisma.purchaseOrder.update({ where: { id: po.id }, data: { paymentMethod: paymentMethod } });
}
