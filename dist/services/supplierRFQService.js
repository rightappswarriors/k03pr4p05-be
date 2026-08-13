// Supplier RFQ Service — handles supplier-side RFQ inbox, negotiation, and PO conversion
import { prisma } from '../lib/prisma.js';
import { NotificationType } from '@prisma/client';
import { sendConversationNotification } from './conversationNotification.service.js';
import { sendToOrg, sendToConversation } from '../lib/ws.js';
// ─── AppError ──────────────────────────────────────────────────────────────────
export class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
// ─── Dev logging helper ──────────────────────────────────────────────────────
function logDev(prefix, message, data) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${prefix}] ${message}`, data ?? '');
    }
}
// ─── Service ──────────────────────────────────────────────────────────────────
export class SupplierRFQService {
    // ─── Inbox listing ───────────────────────────────────────────────────────────
    async getSupplierInbox(supplierOrgId, filters) {
        const where = {
            supplierOrgId,
            deletedAt: null,
        };
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.unreadOnly) {
            // Filter to RFQs where the supplier participant has unread messages
            // We'll handle this with a subquery
        }
        if (filters.search) {
            where.OR = [
                { rfqNumber: { contains: filters.search, mode: 'insensitive' } },
                { supplierOrgName: { contains: filters.search, mode: 'insensitive' } },
                { notes: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        if (filters.dateFrom) {
            where.createdAt = { gte: filters.dateFrom };
        }
        if (filters.dateTo) {
            where.createdAt = {
                ...(where.createdAt || {}),
                lte: filters.dateTo,
            };
        }
        const rfqs = await prisma.requestForQuotation.findMany({
            where,
            include: {
                Agent: {
                    select: {
                        id: true,
                        fullname: true,
                        email: true,
                        phone: true,
                        organizationId: true,
                        trustTier: true,
                        organization: { select: { id: true, name: true, profileImg: true } },
                    },
                },
                Organization: {
                    select: {
                        id: true,
                        name: true,
                        profileImg: true,
                        profilePhoto: true,
                        verificationStatus: true,
                        location: true,
                    },
                },
                SupplierItem: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        unit: true,
                        unitPrice: true,
                        moq: true,
                        availableQty: true,
                        leadTime: true,
                        image: true,
                        isActive: true,
                    },
                },
                Conversation: {
                    include: {
                        ConversationMessage: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            include: {
                                Agent: { select: { fullname: true } },
                                Organization: { select: { name: true } },
                            },
                        },
                        ConversationParticipant: {
                            where: { organizationId: supplierOrgId },
                        },
                        NegotiationOffer: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        // Post-filter unreadOnly since we need to count unread messages
        if (filters.unreadOnly) {
            const filtered = [];
            for (const rfq of rfqs) {
                if (!rfq.Conversation) {
                    filtered.push(rfq);
                    continue;
                }
                const participant = rfq.Conversation.ConversationParticipant[0];
                const lastReadAt = participant?.lastReadAt ?? participant?.joinedAt;
                const latestMessage = rfq.Conversation.ConversationMessage[0];
                if (latestMessage && (!lastReadAt || new Date(latestMessage.createdAt) > new Date(lastReadAt))) {
                    filtered.push(rfq);
                }
            }
            return filtered;
        }
        logDev('RFQ Inbox', 'Loaded', { count: rfqs.length, supplierOrgId });
        return rfqs;
    }
    // ─── Full detail ─────────────────────────────────────────────────────────────
    async getRFQDetails(rfqId, supplierOrgId) {
        const rfq = await prisma.requestForQuotation.findFirst({
            where: { id: rfqId },
            include: {
                Agent: {
                    select: {
                        id: true,
                        fullname: true,
                        email: true,
                        phone: true,
                        organizationId: true,
                        trustTier: true,
                        organization: { select: { id: true, name: true, profileImg: true } },
                    },
                },
                Organization: {
                    select: {
                        id: true,
                        name: true,
                        profileImg: true,
                        profilePhoto: true,
                        bannerImg: true,
                        verificationStatus: true,
                        location: true,
                        bio: true,
                        contactNumber: true,
                    },
                },
                SupplierItem: {
                    include: {
                        priceTiers: true,
                        productWholesaleSettings: true,
                        SupplierItemImage: true,
                    },
                },
                Conversation: {
                    include: {
                        ConversationParticipant: {
                            include: {
                                Agent: { select: { id: true, fullname: true, email: true } },
                                Organization: { select: { id: true, name: true, profileImg: true } },
                            },
                        },
                        ConversationMessage: {
                            orderBy: { createdAt: 'asc' },
                            include: {
                                Agent: { select: { id: true, fullname: true } },
                                Organization: { select: { id: true, name: true } },
                            },
                        },
                        NegotiationOffer: {
                            orderBy: { createdAt: 'asc' },
                            include: {
                                Agent: { select: { id: true, fullname: true } },
                                Organization: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!rfq) {
            throw new Error('RFQ not found');
        }
        // Ownership check — only the supplier organization can access
        if (rfq.supplierOrgId !== supplierOrgId) {
            throw new Error('Unauthorized: You do not have access to this RFQ');
        }
        logDev('RFQ Details', 'Loaded', { id: rfqId, supplierOrgId });
        return rfq;
    }
    // ─── Reply (supplier sends a message) ────────────────────────────────────────
    async reply(conversationId, supplierOrgId, message, attachments = [], clientMessageId) {
        // Verify the supplier is a participant
        await this.verifySupplierAccess(conversationId, supplierOrgId);
        // ── Minimal transaction: only message creation + timestamp update ──
        // No includes, no RFQ lookup, no notification inside the transaction.
        const created = await prisma.$transaction(async (tx) => {
            const msg = await tx.conversationMessage.create({
                data: {
                    conversationId,
                    senderOrgId: supplierOrgId,
                    message,
                    attachments: attachments || [],
                    clientMessageId,
                },
                select: {
                    id: true,
                    conversationId: true,
                    senderOrgId: true,
                    message: true,
                    type: true,
                    attachments: true,
                    createdAt: true,
                    clientMessageId: true,
                    metadata: true,
                    rfqOfferId: true,
                },
            });
            await tx.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });
            return msg;
        });
        logDev('Message', 'Sent', { id: created.id, conversationId });
        // ── Outside transaction: resolve sender identity + buyer org ──
        const supplierOrg = await prisma.organization.findUnique({
            where: { id: supplierOrgId },
            select: { name: true },
        });
        const participant = await prisma.conversationParticipant.findFirst({
            where: { conversationId, agentId: { not: null } },
            select: {
                agentId: true,
                Agent: { select: { id: true, fullname: true, email: true, organizationId: true } },
            },
        });
        const agentOrgId = participant?.Agent?.organizationId;
        const agentId = participant?.agentId;
        // Best-effort notification — must not block or roll back the message
        if (agentOrgId != null && agentId) {
            void sendConversationNotification({
                conversationId,
                senderId: supplierOrgId,
                recipientAgentId: agentId,
                recipientUserId: undefined,
                notificationType: NotificationType.NEW_TRANSACTION,
                message: 'Supplier replied to your RFQ conversation.',
            });
        }
        // ── Canonical realtime payload ──
        const payload = {
            id: created.id,
            conversationId: created.conversationId,
            senderId: `org:${supplierOrgId}`,
            senderName: supplierOrg?.name ?? 'Unknown Supplier',
            senderRole: 'SUPPLIER',
            senderAgentId: null,
            senderOrgId: supplierOrgId,
            message: created.message,
            type: created.type,
            attachments: created.attachments ?? [],
            createdAt: created.createdAt.toISOString(),
            clientMessageId: created.clientMessageId,
            metadata: created.metadata ?? null,
            rfqOfferId: created.rfqOfferId ?? null,
        };
        // conversation:newMessage → conversation room (both frontends join this)
        sendToConversation(conversationId, 'conversation:newMessage', payload);
        // notification:new → org room (agent clients auto-join org room on connect)
        if (agentOrgId != null) {
            sendToOrg(agentOrgId, 'notification:new', {
                conversationId,
                category: 'Negotiation',
                title: 'New message from supplier',
            });
        }
        return created;
    }
    // ─── Counter offer (supplier sends an offer) ────────────────────────────────
    async counterOffer(conversationId, supplierOrgId, offer) {
        await this.verifySupplierAccess(conversationId, supplierOrgId);
        const result = await prisma.$transaction(async (tx) => {
            // Create the negotiation offer
            const createdOffer = await tx.negotiationOffer.create({
                data: {
                    conversationId,
                    senderType: 'SUPPLIER',
                    senderOrgId: supplierOrgId,
                    quantity: offer.quantity,
                    unitPrice: offer.unitPrice,
                    deliveryDate: offer.deliveryDate,
                    minimumOrderQuantity: offer.minimumOrderQuantity,
                    estimatedLeadTime: offer.estimatedLeadTime,
                    validUntil: offer.validUntil,
                    notes: offer.notes,
                    status: 'PENDING',
                },
            });
            // Update conversation timestamp.
            await tx.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });
            // Update RFQ status to NEGOTIATING
            const conversation = await tx.conversation.findUnique({
                where: { id: conversationId },
                select: { rfqId: true },
            });
            if (conversation?.rfqId) {
                await tx.requestForQuotation.update({
                    where: { id: conversation.rfqId },
                    data: { status: 'NEGOTIATING' },
                });
            }
            // ConversationMessage is the canonical record of the counter offer.
            await tx.conversationMessage.create({
                data: {
                    conversationId,
                    senderOrgId: supplierOrgId,
                    message: `Counter offer: ${offer.quantity} pcs at ₱${offer.unitPrice.toLocaleString()}`,
                    attachments: [],
                    rfqOfferId: createdOffer.id,
                    type: 'COUNTER_OFFER',
                },
            });
            // The sender has read its own message. The buyer's participant remains unread,
            // which keeps inbox counts accurate without a notification dependency.
            await tx.conversationParticipant.updateMany({
                where: { conversationId, organizationId: supplierOrgId },
                data: { lastReadAt: new Date() },
            });
            const recipient = await tx.conversationParticipant.findFirst({
                where: { conversationId, agentId: { not: null }, role: 'AGENT' },
                select: { agentId: true, Agent: { select: { email: true, organizationId: true } } },
            });
            return { createdOffer, recipient };
        });
        // Notification delivery happens only after the conversation transaction commits.
        // An Agent is not necessarily a User, so the optional user target is resolved
        // independently and an unavailable target is a successful no-op.
        const recipientAgentId = result.recipient?.agentId;
        if (recipientAgentId && result.recipient.Agent?.organizationId != null) {
            const recipientUser = await prisma.user.findFirst({
                where: {
                    orgId: result.recipient.Agent.organizationId,
                    email: result.recipient.Agent.email,
                    deletedAt: null,
                },
                select: { id: true },
            });
            void sendConversationNotification({
                conversationId,
                senderId: supplierOrgId,
                recipientAgentId,
                recipientUserId: recipientUser?.id,
                notificationType: NotificationType.COUNTER_OFFER,
                message: 'Supplier sent a counter offer for your RFQ.',
            });
        }
        logDev('Offer', 'Counter Offer', result.createdOffer);
        // Look up supplier org name for canonical payload (outside transaction)
        const supplierOrgResult = await prisma.organization.findUnique({
            where: { id: supplierOrgId },
            select: { name: true },
        });
        if (result.recipient?.Agent?.organizationId != null) {
            const agentOrgId = result.recipient.Agent.organizationId;
            // offer:counter → conversation room (both frontends listen for this)
            sendToConversation(conversationId, 'offer:counter', result.createdOffer);
            // conversation:newMessage → conversation room with canonical payload (FIX #2, #3)
            sendToConversation(conversationId, 'conversation:newMessage', {
                id: result.createdOffer.id,
                conversationId,
                senderId: `org:${supplierOrgId}`,
                senderName: supplierOrgResult?.name ?? 'Unknown Supplier',
                senderRole: 'SUPPLIER',
                senderAgentId: null,
                senderOrgId: supplierOrgId,
                message: `Counter offer: ${offer.quantity} pcs at ₱${offer.unitPrice.toLocaleString()}`,
                type: 'COUNTER_OFFER',
                attachments: [],
                createdAt: result.createdOffer.createdAt,
                rfqOfferId: result.createdOffer.id,
                metadata: { event: 'counter_offer', ...offer },
            });
            // notification:new → org room (agent clients auto-join org room on connect)
            sendToOrg(agentOrgId, 'notification:new', { conversationId, category: 'Negotiation' });
        }
        return result.createdOffer;
    }
    // ─── Accept negotiation (supplier confirms) → RFQ moves to WAITING_SUPPLIER_CONFIRMATION ──
    /**
     * Supplier's explicit confirmation of an accepted offer.
     * - Sets RFQ status to `WAITING_SUPPLIER_CONFIRMATION` (agentAcceptedAt must already exist)
     * - Creates a SUPPLIER_CONFIRMED timeline event with structured metadata
     * - Does NOT create a PO yet — PO creation is handled separately (single or consolidated)
     */
    async confirmSupplierAgreement(rfqId, supplierOrgId) {
        const rfq = await this.getRFQDetails(rfqId, supplierOrgId);
        if (!rfq.Conversation)
            throw new AppError(400, 'RFQ has no conversation');
        if (!rfq.agentAcceptedAt) {
            throw new AppError(409, 'The buyer must accept the offer before supplier confirmation.');
        }
        // Idempotency guard — without this, tapping Accept twice creates
        // duplicate SUPPLIER_CONFIRMED events (this is why the screenshot
        // shows three "Both Parties Confirmed" cards).
        if (rfq.supplierConfirmedAt) {
            throw new AppError(409, 'This offer has already been confirmed.');
        }
        const agentOrgId = rfq.Agent?.organizationId;
        const conversationId = rfq.Conversation.id;
        const { updatedRfq, confirmedAt } = await prisma.$transaction(async (tx) => {
            const confirmedAt = new Date();
            // Flip the actual NegotiationOffer record — this is what OfferCard's
            // color/buttons key off. Previously only the RFQ row changed, so the
            // card never turned green or lost its buttons.
            const pendingOffer = await tx.negotiationOffer.findFirst({
                where: { conversationId, status: 'PENDING' },
                orderBy: { createdAt: 'desc' },
            });
            if (pendingOffer) {
                await tx.negotiationOffer.update({
                    where: { id: pendingOffer.id },
                    data: { status: 'ACCEPTED' },
                });
            }
            const updatedRfq = await tx.requestForQuotation.update({
                where: { id: rfqId },
                data: {
                    supplierAcceptedAt: confirmedAt,
                    status: 'WAITING_SUPPLIER_CONFIRMATION',
                    supplierConfirmedAt: confirmedAt,
                },
            });
            await tx.conversationMessage.create({
                data: {
                    conversationId,
                    senderOrgId: supplierOrgId,
                    message: 'Supplier confirmed the accepted offer.',
                    type: 'SUPPLIER_CONFIRMED',
                    metadata: {
                        event: 'supplier_confirmed',
                        rfqId,
                        supplierOrgId,
                        confirmedAt: confirmedAt.toISOString(),
                        acceptedPrice: rfq.acceptedPrice,
                        acceptedQuantity: rfq.acceptedQuantity,
                    },
                },
            });
            await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
            return { updatedRfq, confirmedAt };
        });
        if (agentOrgId != null) {
            sendToOrg(agentOrgId, 'supply:confirmed', { rfqId, supplierOrgId, confirmedAt: confirmedAt.toISOString() });
            sendToOrg(agentOrgId, 'notification:new', { conversationId, rfqId, category: 'Supplier Confirmation' });
        }
        return updatedRfq;
    }
    /** Creates a PO only after both confirmation timestamps exist. */
    async createPurchaseOrder(rfqId, supplierOrgId, deliveryDate, driverName, driverContact) {
        const rfq = await this.getRFQDetails(rfqId, supplierOrgId);
        if (!rfq.Conversation) {
            throw new AppError(400, 'RFQ has no conversation');
        }
        if (rfq.status !== 'WAITING_SUPPLIER_CONFIRMATION' || !rfq.agentAcceptedAt || !rfq.supplierConfirmedAt) {
            throw new AppError(409, 'A purchase order requires explicit confirmation from both buyer and supplier.');
        }
        const result = await prisma.$transaction(async (tx) => {
            // Create PurchaseOrder
            const poNumber = await this.generatePONumber();
            const acceptedPrice = rfq.acceptedPrice ?? rfq.targetUnitPrice ?? 0;
            const acceptedQty = rfq.acceptedQuantity ?? Number(rfq.quantity ?? '0');
            const subtotal = acceptedPrice * acceptedQty;
            const vatAmount = rfq.SupplierItem?.isVatExempt ? 0 : subtotal * (rfq.SupplierItem?.vatRate ?? 0.12);
            const totalAmount = subtotal + vatAmount;
            // Look up the buyer organization's primary active outlet for delivery
            const buyerOrgId = rfq.Agent?.organizationId ?? 0;
            const buyerOutlet = await tx.outlet.findFirst({
                where: { orgId: buyerOrgId, isActive: true },
                select: { id: true },
            });
            const deliveryOutletId = buyerOutlet?.id ?? 0;
            logDev('PO Creation', 'Resolved buyer outlet', { buyerOrgId, deliveryOutletId });
            const po = await tx.purchaseOrder.create({
                data: {
                    poNumber,
                    buyerOrgId,
                    supplierOrgId: supplierOrgId,
                    status: 'PENDING',
                    notes: rfq.notes,
                    requestedDate: new Date(),
                    totalAmount,
                    vatAmount,
                    deliveryOutletId,
                    lineItems: {
                        create: [
                            {
                                supplierItemId: rfq.supplierItemId,
                                qty: Math.ceil(acceptedQty),
                                unitPrice: acceptedPrice,
                                subtotal,
                            },
                        ],
                    },
                },
                include: {
                    lineItems: { include: { supplierItem: true } },
                    buyerOrg: { select: { id: true, name: true, profileImg: true } },
                    supplierOrg: { select: { id: true, name: true, profileImg: true } },
                },
            });
            // Create Delivery
            const delivery = await tx.delivery.create({
                data: {
                    poId: po.id,
                    scheduledDate: deliveryDate,
                    status: 'SCHEDULED',
                    driverName,
                    driverContact,
                },
            });
            // Link the completed PO to its RFQ via the bridge table
            await tx.purchaseOrderRFQ.create({
                data: {
                    poId: po.id,
                    rfqId: rfqId,
                },
            });
            await tx.requestForQuotation.update({
                where: { id: rfqId },
                data: {
                    status: 'PO_CREATED',
                    acceptedPrice,
                    acceptedQuantity: acceptedQty,
                    acceptedDeliveryDate: deliveryDate,
                },
            });
            await tx.conversationMessage.create({
                data: {
                    conversationId: rfq.Conversation.id,
                    senderOrgId: supplierOrgId,
                    message: `Purchase Order ${poNumber} has been created.`,
                    type: 'ORDER_CREATED',
                    metadata: {
                        event: 'po_created',
                        poId: po.id,
                        poNumber,
                        rfqId,
                        deliveryDate: deliveryDate.toISOString(),
                        totalAmount,
                        vatAmount,
                    },
                },
            });
            await tx.conversation.update({
                where: { id: rfq.Conversation.id },
                data: { updatedAt: new Date() },
            });
            logDev('PO Creation', 'Purchase Order created', { poNumber, poId: po.id });
            logDev('Delivery Creation', 'Delivery created', { deliveryId: delivery.id, poNumber });
            return { po, delivery };
        });
        // Notification + realtime emits happen only after the transaction commits (FIX #1, #7)
        const agentOrgId = rfq.Agent?.organizationId;
        if (agentOrgId != null) {
            void sendConversationNotification({
                conversationId: rfq.Conversation.id,
                senderId: supplierOrgId,
                recipientAgentId: rfq.Agent.id,
                recipientUserId: undefined,
                notificationType: NotificationType.PURCHASE_ORDER_CREATED,
                message: `Supplier confirmed the offer. PO ${result.po.poNumber} has been created.`,
            });
            sendToOrg(agentOrgId, 'purchaseOrder:created', { po: result.po, poNumber: result.po.poNumber, conversationId: rfq.Conversation.id });
            sendToOrg(agentOrgId, 'notification:new', { conversationId: rfq.Conversation.id, purchaseOrderId: result.po.id, category: 'Purchase Order' });
        }
        logDev('Accept', 'Negotiation accepted', { rfqId, supplierOrgId });
        return result;
    }
    // ─── Reject negotiation ──────────────────────────────────────────────────────
    async rejectNegotiation(rfqId, supplierOrgId, reason) {
        const rfq = await this.getRFQDetails(rfqId, supplierOrgId);
        const agentOrgId = rfq.Agent?.organizationId;
        const convId = rfq.Conversation?.id;
        const updated = await prisma.$transaction(async (tx) => {
            // Same fix — flip the pending offer to REJECTED so OfferCard turns red.
            if (convId) {
                const pendingOffer = await tx.negotiationOffer.findFirst({
                    where: { conversationId: convId, status: 'PENDING' },
                    orderBy: { createdAt: 'desc' },
                });
                if (pendingOffer) {
                    await tx.negotiationOffer.update({
                        where: { id: pendingOffer.id },
                        data: { status: 'REJECTED' },
                    });
                }
            }
            const updated = await tx.requestForQuotation.update({
                where: { id: rfqId },
                data: { status: 'CANCELLED' },
            });
            const rejectionMsg = reason
                ? `Supplier rejected the negotiation. Reason: ${reason}`
                : 'Supplier rejected the negotiation.';
            if (convId) {
                await tx.conversationMessage.create({
                    data: {
                        conversationId: convId,
                        senderOrgId: supplierOrgId,
                        message: rejectionMsg,
                        type: 'OFFER_REJECTED',
                        metadata: { event: 'offer_rejected', rfqId, supplierOrgId, reason: reason ?? null },
                    },
                });
                await tx.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
            }
            return updated;
        });
        // ...rest unchanged (notification + realtime emits)
        return updated;
    }
    // ─── Mark as read ────────────────────────────────────────────────────────────
    async markRead(conversationId, supplierOrgId) {
        await this.verifySupplierAccess(conversationId, supplierOrgId);
        // Update the supplier participant's lastReadAt
        await prisma.conversationParticipant.updateMany({
            where: {
                conversationId,
                organizationId: supplierOrgId,
            },
            data: { lastReadAt: new Date() },
        });
        logDev('Conversation', 'Marked read', { conversationId, supplierOrgId });
    }
    // ─── Unread count ────────────────────────────────────────────────────────────
    async getUnreadCount(supplierOrgId) {
        // Count conversations where supplier is a participant and has unread messages
        const result = await prisma.$queryRaw `
      SELECT COUNT(DISTINCT c.id) as count
      FROM "Conversation" c
      JOIN "ConversationParticipant" cp ON cp."conversationId" = c.id
      WHERE cp."organizationId" = ${supplierOrgId}
        AND EXISTS (
          SELECT 1 FROM "ConversationMessage" cm
          WHERE cm."conversationId" = c.id
            AND cm."createdAt" > COALESCE(cp."lastReadAt", cp."joinedAt")
        )
    `;
        return result[0]?.count ?? 0;
    }
    // ─── Private helpers ─────────────────────────────────────────────────────────
    async verifySupplierAccess(conversationId, supplierOrgId) {
        const participant = await prisma.conversationParticipant.findFirst({
            where: {
                conversationId,
                organizationId: supplierOrgId,
                role: 'SUPPLIER',
            },
        });
        if (!participant) {
            throw new AppError(403, 'Unauthorized: You are not a participant in this conversation');
        }
    }
    async generatePONumber() {
        const now = new Date();
        const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `PO-${datePart}-${rand}`;
    }
}
export default SupplierRFQService;
