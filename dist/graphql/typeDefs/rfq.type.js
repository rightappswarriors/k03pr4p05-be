// GraphQL type definitions for RFQ Conversation & Negotiation
import { objectType, enumType, inputObjectType, arg } from 'nexus';
// ─── Enums ────────────────────────────────────────────────────────────────────
export const RfqStatusEnum = enumType({
    name: 'RfqStatus',
    members: [
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
        'NEGOTIATING', 'SUPPLIER_OFFERED', 'BUYER_COUNTERED',
        'NEGOTIATION_COMPLETED', 'NEGOTIATION_ACCEPTED', 'PO_CREATED',
        'PENDING_SUPPLIER_RESPONSE', 'COUNTER_OFFERED',
        'AGENT_ACCEPTED_FINAL', 'SUPPLIER_ACCEPTED_FINAL',
        'CANCELLED', 'EXPIRED',
        'RFQ_RECEIVED', 'WAITING_SUPPLIER_CONFIRMATION',
    ],
});
export const ConversationRoleEnum = enumType({
    name: 'ConversationRole',
    members: ['AGENT', 'SUPPLIER'],
});
export const NegotiationOfferStatusEnum = enumType({
    name: 'NegotiationOfferStatus',
    members: ['PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED'],
});
export const ConversationTypeEnum = enumType({
    name: 'ConversationType',
    members: ['RFQ', 'ORDER'],
});
export const SortOrderEnum = enumType({
    name: 'SortOrder',
    members: ['asc', 'desc'],
});
export const MessageOrderByInput = inputObjectType({
    name: 'MessageOrderByInput',
    definition(t) {
        t.field('createdAt', { type: 'SortOrder' });
    },
});
export const OfferOrderByInput = inputObjectType({
    name: 'OfferOrderByInput',
    definition(t) {
        t.field('createdAt', { type: 'SortOrder' });
    },
});
// ─── GraphQL Types ────────────────────────────────────────────────────────────
export const NegotiationOffer = objectType({
    name: 'NegotiationOffer',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('conversationId');
        t.nonNull.field('senderType', { type: 'ConversationRole' });
        t.nullable.string('senderAgentId');
        t.nullable.int('senderOrgId');
        t.nonNull.float('quantity');
        t.nonNull.float('unitPrice');
        t.nullable.field('deliveryDate', { type: 'DateTime' });
        t.nullable.int('minimumOrderQuantity');
        t.nullable.string('estimatedLeadTime');
        t.nullable.field('validUntil', { type: 'DateTime' });
        t.nullable.string('notes');
        t.nonNull.field('status', { type: 'NegotiationOfferStatus' });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('senderAgent', {
            type: 'Agent',
            resolve: (parent, _, ctx) => parent.senderAgentId
                ? ctx.prisma.agent.findUnique({ where: { id: parent.senderAgentId } })
                : null,
        });
        t.nullable.field('senderOrg', {
            type: 'Organization',
            resolve: (parent, _, ctx) => parent.senderOrgId
                ? ctx.prisma.organization.findUnique({ where: { id: parent.senderOrgId } })
                : null,
        });
    },
});
export const ConversationMessage = objectType({
    name: 'ConversationMessage',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('conversationId');
        t.nullable.string('senderAgentId');
        t.nullable.int('senderOrgId');
        t.nonNull.string('message');
        t.nullable.field('metadata', { type: 'Json' });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.list.nonNull.string('attachments');
        t.nonNull.field('type', { type: 'MessageType' });
        t.nullable.field('senderAgent', {
            type: 'Agent',
            resolve: (parent, _, ctx) => parent.senderAgentId
                ? ctx.prisma.agent.findUnique({ where: { id: parent.senderAgentId } })
                : null,
        });
        t.nullable.field('senderOrg', {
            type: 'Organization',
            resolve: (parent, _, ctx) => parent.senderOrgId
                ? ctx.prisma.organization.findUnique({ where: { id: parent.senderOrgId } })
                : null,
        });
    },
});
export const MessageTypeEnum = enumType({
    name: 'MessageType',
    members: [
        'TEXT',
        'RFQ_CREATED',
        'COUNTER_OFFER',
        'FINAL_OFFER',
        "PRICE_ACCEPTED",
        "PRICE_REJECTED",
        "SYSTEM",
        "ORDER_CREATED",
        "PAYMENT_UPDATE",
        "OFFER_ACCEPTED",
        "OFFER_REJECTED",
        "SUPPLIER_CONFIRMED",
        "CONSOLIDATED_PO_CREATED",
        "PO_ACCEPTED",
        "PO_REJECTED",
        "RECEIPT_UPLOADED",
        "PAYMENT_RECEIVED",
        "DELIVERY_SCHEDULED",
        "SHIPMENT_DISPATCHED",
        "DELIVERY_COMPLETED"
    ],
});
export const ConversationParticipant = objectType({
    name: 'ConversationParticipant',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('conversationId');
        t.nullable.string('agentId');
        t.nullable.int('organizationId');
        t.nonNull.field('role', { type: 'ConversationRole' });
        t.nonNull.field('joinedAt', { type: 'DateTime' });
        t.nullable.field('lastReadAt', { type: 'DateTime' });
        t.nullable.field('agent', {
            type: 'Agent',
            resolve: (parent, _, ctx) => parent.agentId
                ? ctx.prisma.agent.findUnique({ where: { id: parent.agentId } })
                : null,
        });
        t.nullable.field('organization', {
            type: 'Organization',
            resolve: (parent, _, ctx) => parent.organizationId
                ? ctx.prisma.organization.findUnique({ where: { id: parent.organizationId } })
                : null,
        });
    },
});
export const Conversation = objectType({
    name: 'Conversation',
    definition(t) {
        t.nonNull.string('id');
        t.nullable.string('rfqId');
        t.nullable.string('poId');
        t.nonNull.field('type', { type: 'ConversationType' });
        t.nullable.field('po', {
            type: 'PurchaseOrder',
            resolve: (parent, _, ctx) => parent.poId
                ? ctx.prisma.purchaseOrder.findUnique({ where: { id: parent.poId } })
                : null,
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('rfq', {
            type: 'RequestForQuotation',
            resolve: (parent, _, ctx) => parent.rfqId
                ? ctx.prisma.requestForQuotation.findUnique({
                    where: { id: parent.rfqId },
                })
                : null,
        });
        t.nonNull.list.nonNull.field('participants', {
            type: 'ConversationParticipant',
            resolve: (parent, _, ctx) => ctx.prisma.conversationParticipant.findMany({
                where: { conversationId: parent.id },
            }),
        });
        t.nonNull.list.nonNull.field('messages', {
            type: 'ConversationMessage',
            args: {
                orderBy: arg({ type: 'MessageOrderByInput' }),
                take: arg({ type: 'Int' }),
            },
            resolve: (parent, { orderBy, take }, ctx) => {
                return ctx.prisma.conversationMessage.findMany({
                    where: { conversationId: parent.id },
                    orderBy: orderBy,
                    take: take ?? undefined,
                    include: { Agent: true, Organization: true },
                });
            },
        });
        t.nonNull.list.nonNull.field('offers', {
            type: 'NegotiationOffer',
            args: {
                orderBy: arg({ type: 'OfferOrderByInput' }),
                take: arg({ type: 'Int' }),
            },
            resolve: (parent, { orderBy, take }, ctx) => {
                return ctx.prisma.negotiationOffer.findMany({
                    where: { conversationId: parent.id },
                    orderBy: orderBy,
                    take: take ?? undefined,
                    include: { Agent: true, Organization: true },
                }).then(async (legacyOffers) => {
                    if (!parent.rfqId)
                        return legacyOffers;
                    const rfqOffers = await ctx.prisma.rfqOffer.findMany({
                        where: { rfqId: parent.rfqId },
                        include: { Agent: true, Organization: true },
                    });
                    const sharedOffers = rfqOffers.map((offer) => ({
                        ...offer,
                        conversationId: parent.id,
                        senderType: offer.senderAgentId ? 'AGENT' : 'SUPPLIER',
                        senderOrgId: offer.senderSupplierId,
                        estimatedLeadTime: offer.estimatedLeadDays?.toString() ?? null,
                        minimumOrderQuantity: null,
                    }));
                    const direction = orderBy?.createdAt ?? 'asc';
                    return [...legacyOffers, ...sharedOffers]
                        .sort((a, b) => direction === 'desc'
                        ? b.createdAt.getTime() - a.createdAt.getTime()
                        : a.createdAt.getTime() - b.createdAt.getTime())
                        .slice(0, take ?? undefined);
                });
            },
        });
    },
});
export const RequestForQuotation = objectType({
    name: 'RequestForQuotation',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('rfqNumber');
        t.nonNull.string('agentId');
        t.nullable.int('supplierOrgId');
        t.nullable.string('supplierOrgName');
        t.nullable.string('supplierItemId');
        t.nonNull.field('status', { type: 'RfqStatus' });
        t.nullable.string('conversationId');
        t.nullable.float('targetUnitPrice');
        t.nullable.string('quantity');
        t.nullable.field('expectedDeliveryDate', { type: 'DateTime' });
        t.nullable.int('validityDays');
        t.nullable.string('notes');
        t.nullable.float('acceptedPrice');
        t.nullable.float('acceptedQuantity');
        t.nullable.field('acceptedDeliveryDate', { type: 'DateTime' });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });
        t.nullable.field('supplierConfirmedAt', { type: 'DateTime' });
        t.nullable.field('supplierAcceptedAt', { type: 'DateTime' });
        t.nullable.field('agentAcceptedAt', { type: 'DateTime' });
        t.nullable.field('agent', {
            type: 'Agent',
            resolve: (parent, _, ctx) => ctx.prisma.agent.findUnique({ where: { id: parent.agentId } }),
        });
        t.nullable.field('supplierOrg', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.organization.findUnique({ where: { id: parent.supplierOrgId } }),
        });
        t.nullable.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => parent.supplierItemId
                ? ctx.prisma.supplierItem.findUnique({
                    where: { id: parent.supplierItemId },
                    include: { priceTiers: true, productWholesaleSettings: true },
                })
                : null,
        });
        t.nullable.field('conversation', {
            type: 'Conversation',
            resolve: (parent, _, ctx) => parent.conversationId
                ? ctx.prisma.conversation.findUnique({
                    where: { id: parent.conversationId },
                    include: { ConversationMessage: true, ConversationParticipant: true, NegotiationOffer: true },
                })
                : null,
        });
        // Financial and fulfilment values belong to the resulting PO, never
        // directly to the RFQ. This preserves the RFQ as the negotiation record.
        t.nullable.field('purchaseOrder', {
            type: 'PurchaseOrder',
            resolve: async (parent, _, ctx) => {
                const rfqLink = await ctx.prisma.purchaseOrderRFQ.findFirst({
                    where: { rfqId: parent.id, po: { status: { not: 'CANCELLED' } } },
                    select: { poId: true },
                });
                if (!rfqLink)
                    return null;
                return ctx.prisma.purchaseOrder.findUnique({
                    where: { id: rfqLink.poId },
                    include: { lineItems: { include: { supplierItem: true } }, delivery: true },
                });
            },
        });
    },
});
// ─── Input Types ──────────────────────────────────────────────────────────────
export const ReplyToRFQInput = inputObjectType({
    name: 'ReplyToRFQInput',
    definition(t) {
        t.nonNull.string('rfqId');
        t.nonNull.string('message');
        t.list.string('attachments');
        t.nullable.string('clientMessageId');
    },
});
export const CounterOfferInput = inputObjectType({
    name: 'CounterOfferInput',
    definition(t) {
        t.nonNull.string('rfqId');
        t.nonNull.float('quantity');
        t.nonNull.float('unitPrice');
        t.nullable.field('deliveryDate', { type: 'DateTime' });
        t.nullable.int('minimumOrderQuantity');
        t.nullable.string('estimatedLeadTime');
        t.nullable.field('validUntil', { type: 'DateTime' });
        t.nullable.string('notes');
    },
});
export const AcceptNegotiationInput = inputObjectType({
    name: 'AcceptNegotiationInput',
    definition(t) {
        t.nonNull.string('rfqId');
    },
});
export const RejectNegotiationInput = inputObjectType({
    name: 'RejectNegotiationInput',
    definition(t) {
        t.nonNull.string('rfqId');
        t.nullable.string('reason');
    },
});
export const RfqFiltersInput = inputObjectType({
    name: 'RfqFiltersInput',
    definition(t) {
        t.nullable.field('status', { type: 'RfqStatus' });
        t.nullable.string('search');
        t.nullable.boolean('unreadOnly');
        t.nullable.field('dateFrom', { type: 'DateTime' });
        t.nullable.field('dateTo', { type: 'DateTime' });
    },
});
// Purchase order already exported in puchaseOrder.type.ts, but we need to export it here for the RFQ module to use it don't make another PurchaseOrder type
export const CreatePurchaseOrderOutput = objectType({
    name: 'CreatePurchaseOrderOutput',
    definition(t) {
        t.nonNull.boolean('success');
        t.nonNull.string('poNumber');
        t.field('purchaseOrder', { type: 'PurchaseOrder' });
    },
});
// ─── RFQ Eligibility Validation Result ──────────────────────────────────────
export const RfqEligibilityResult = objectType({
    name: 'RfqEligibilityResult',
    definition(t) {
        t.nonNull.boolean('valid');
        t.nonNull.boolean('rfqExists');
        t.nonNull.boolean('correctOrg');
        t.nonNull.boolean('notExpired');
        t.nonNull.boolean('hasAcceptedOffer');
        t.nonNull.boolean('notCancelled');
        t.nonNull.boolean('notRejected');
        t.nonNull.boolean('notConsumed');
        t.nullable.string('reason');
    },
});
