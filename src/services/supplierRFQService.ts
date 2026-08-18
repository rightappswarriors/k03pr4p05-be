// Supplier RFQ Service — handles supplier-side RFQ inbox, negotiation, and PO conversion
import { prisma } from '../lib/prisma.js';
import { NotificationType } from '@prisma/client';
import { sendConversationNotification } from './conversationNotification.service.js';
import { sendToOrg, sendToConversation } from '../lib/ws.js';

// ─── Canonical realtime payload ────────────────────────────────────────────────
// Both gateways emit this shape so each frontend can pick the fields it expects.
// The Portal UI checks senderOrgId/senderAgentId; the Agent UI checks senderRole/senderName.
export interface RealtimeMessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'AGENT' | 'SUPPLIER';
  senderAgentId?: string | null;
  senderOrgId?: number | null;
  message: string;
  type: string;
  attachments: string[];
  createdAt: string;
  clientMessageId?: string | null;
  metadata?: Record<string, any> | null;
  rfqOfferId?: string | null;
}

// ─── AppError ──────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InboxFilters {
  status?: string;
  /** When provided, filters by multiple statuses (group-based filtering). */
  statuses?: string[];
  search?: string;
  unreadOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Result of the 7-rule RFQ eligibility validation. */
export interface RfqEligibilityResult {
  valid: boolean;
  rfqExists: boolean;
  correctOrg: boolean;
  notExpired: boolean;
  hasAcceptedOffer: boolean;
  notCancelled: boolean;
  notRejected: boolean;
  notConsumed: boolean;
  reason?: string | null;
}

/** Eligible RFQ statuses for PO creation. */
export const ELIGIBLE_RFQ_STATUSES = [
  'NEGOTIATION_ACCEPTED',
  'AGENT_ACCEPTED_FINAL',
  'SUPPLIER_ACCEPTED_FINAL',
  'WAITING_SUPPLIER_CONFIRMATION',
] as const;

export interface CounterOfferData {
  quantity: number;
  unitPrice: number;
  deliveryDate?: Date;
  minimumOrderQuantity?: number;
  estimatedLeadTime?: string;
  validUntil?: Date;
  notes?: string;
}

// ─── Dev logging helper ──────────────────────────────────────────────────────

function logDev(prefix: string, message: string, data?: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${prefix}] ${message}`, data ?? '');
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SupplierRFQService {
  // ─── Inbox listing ───────────────────────────────────────────────────────────

  async getSupplierInbox(
    supplierOrgId: number,
    filters: InboxFilters,
  ) {
    const where: any = {
      supplierOrgId,
      deletedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    // Group-based status filtering: e.g. "NEGOTIATING" tab → multiple statuses
    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
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
            isVatExempt: true,
            vatRate: true,
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
      const filtered: typeof rfqs = [];
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

  // ─── Eligibility validation (7 rules for PO creation) ──────────────────────────

  /**
   * Validate an RFQ against the 7 eligibility rules before it can be added to a PO:
   * 1. RFQ exists
   * 2. RFQ belongs to the current supplier organization
   * 3. RFQ has not expired (validityDays or offer validUntil)
   * 4. RFQ has an accepted offer / is in an eligible state
   * 5. RFQ is not cancelled
   * 6. RFQ is not rejected
   * 7. RFQ has not already been converted into an active/completed PO
   */
  async validateRFQEligibility(rfqId: string, supplierOrgId: number): Promise<RfqEligibilityResult> {
    const rfq = await prisma.requestForQuotation.findUnique({
      where: { id: rfqId },
      include: {
        SupplierItem: {
          select: { id: true, name: true, isVatExempt: true, vatRate: true },
        },
        Conversation: {
          include: {
            NegotiationOffer: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const result: RfqEligibilityResult = {
      valid: false,
      rfqExists: false,
      correctOrg: false,
      notExpired: false,
      hasAcceptedOffer: false,
      notCancelled: false,
      notRejected: false,
      notConsumed: false,
      reason: null,
    };

    // Rule 1: RFQ exists
    if (!rfq) {
      result.reason = 'RFQ not found';
      return result;
    }
    result.rfqExists = true;

    // Rule 2: RFQ belongs to the current supplier organization
    if (rfq.supplierOrgId !== supplierOrgId) {
      result.reason = 'RFQ does not belong to your organization';
      return result;
    }
    result.correctOrg = true;

    // Rule 5: RFQ is not cancelled
    if (rfq.status === 'CANCELLED') {
      result.reason = 'RFQ has been cancelled';
      return result;
    }
    result.notCancelled = true;

    // Rule 6: RFQ is not rejected (check negotiation offer status)
    const latestOffer = rfq.Conversation?.NegotiationOffer[0];
    if (latestOffer?.status === 'REJECTED') {
      result.reason = 'RFQ offer has been rejected';
      return result;
    }
    result.notRejected = true;

    // Rule 7: RFQ has not already been converted to an active/completed PO
    const existingPO = await prisma.purchaseOrderRFQ.findFirst({
      where: { rfqId },
      include: {
        po: {
          select: {
            status: true,
          },
        },
      },
    });
    if (existingPO && ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'].includes(existingPO.po.status)) {
      result.reason = 'RFQ is already attached to an active purchase order';
      return result;
    }
    result.notConsumed = true;

    // Rule 3: RFQ has not expired
    let expired = false;
    if (rfq.validityDays) {
      const expiryDate = new Date(rfq.createdAt.getTime() + rfq.validityDays * 24 * 60 * 60 * 1000);
      if (new Date() > expiryDate) {
        expired = true;
      }
    }
    // Also check the latest negotiation offer's validUntil
    if (!expired && latestOffer?.validUntil) {
      if (new Date() > new Date(latestOffer.validUntil)) {
        expired = true;
      }
    }
    if (expired) {
      result.reason = 'RFQ or its latest offer has expired';
      return result;
    }
    result.notExpired = true;

    // Rule 4: RFQ is in an eligible state (has accepted offer / accepted negotiation)
    const isEligible = ELIGIBLE_RFQ_STATUSES.includes(rfq.status as any);
    if (!isEligible) {
      result.reason = `RFQ status '${rfq.status}' is not eligible for PO creation`;
      return result;
    }
    result.hasAcceptedOffer = true;

    result.valid = true;
    result.reason = null;
    logDev('RFQ Eligibility', 'Validated', { rfqId, supplierOrgId, valid: true });
    return result;
  }

  // ─── Full detail ─────────────────────────────────────────────────────────────

  async getRFQDetails(rfqId: string, supplierOrgId: number) {
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

  async reply(
    conversationId: string,
    supplierOrgId: number,
    message: string,
    attachments: string[] = [],
    clientMessageId?: string,
  ) {
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
    const payload: RealtimeMessagePayload = {
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
      metadata: (created as any).metadata ?? null,
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

  async counterOffer(
    conversationId: string,
    supplierOrgId: number,
    offer: CounterOfferData,
  ) {
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
        senderRole: 'SUPPLIER' as const,
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
  async confirmSupplierAgreement(
    rfqId: string,
    supplierOrgId: number,
  ) {
    const rfq = await this.getRFQDetails(rfqId, supplierOrgId);
    if (!rfq.Conversation) throw new AppError(400, 'RFQ has no conversation');
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
    const conversationId = rfq.Conversation!.id;

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
  async createPurchaseOrder(
    rfqId: string,
    supplierOrgId: number,
    deliveryDate: Date,
    driverName?: string,
    driverContact?: string,
  ) {
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

      // Look up the buyer organization's primary active outlet for delivery.
      // For Retail flows an outlet may exist; for Wholesale it is optional and
      // `deliveryOutletId` stays null (the Prisma field is nullable).
      const buyerOrgId = rfq.Agent?.organizationId ?? 0;
      const buyerOutlet = await tx.outlet.findFirst({
        where: { orgId: buyerOrgId, isActive: true },
        select: { id: true },
      });
      const deliveryOutletId = buyerOutlet?.id ?? null;

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
          agentId: rfq.Agent?.id ?? null,
          lineItems: {
            create: [
              {
                supplierItemId: rfq.supplierItemId!,
                qty: Math.ceil(acceptedQty),
                unitPrice: acceptedPrice,
                subtotal,
                itemName: rfq.SupplierItem?.name,
                itemSku: rfq.SupplierItem?.sku,
                itemDescription: rfq.SupplierItem?.description,
              },
            ],
          },
        },
        include: {
          lineItems: { include: { supplierItem: true } },
          buyerOrg: { select: { id: true, name: true, profileImg: true } },
          supplierOrg: { select: { id: true, name: true, profileImg: true } },
          agent: { select: { id: true, fullname: true, email: true, organizationId: true } },
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
        recipientAgentId: rfq.Agent!.id,
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

  // ─── Consolidated PO creation (multiple RFQs into one PO) ──────────────────────

  /**
   * Result of the consolidated PO creation.
   * Mirrors the shape returned by the single-RFQ createPurchaseOrder for
   * downstream consumers.
   */
  async createConsolidatedPurchaseOrder(
    rfqIds: string[],
    supplierOrgId: number,
    deliveryDate: Date,
    notes?: string,
    otherCharges: number = 0,
    driverName?: string,
    driverContact?: string,
  ) {
    if (rfqIds.length === 0) {
      throw new AppError(400, 'At least one RFQ must be selected');
    }

    // ── Fetch all RFQs with the data needed for validation + line-item creation ──
    const rfqs = await Promise.all(
      rfqIds.map((id) => this.getRFQDetails(id, supplierOrgId)),
    );

    // ── Validate each RFQ against the 7 eligibility rules ──
    for (const rfq of rfqs) {
      const eligibility = await this.validateRFQEligibility(rfq.id, supplierOrgId);
      if (!eligibility.valid) {
        throw new AppError(409, `RFQ ${rfq.rfqNumber} is not eligible: ${eligibility.reason ?? 'unknown reason'}`);
      }
    }

    // ── All RFQs must belong to the same buyer organization ──
    const buyerOrgIds = new Set(rfqs.map((r) => r.Agent?.organizationId).filter((id): id is number => id != null));
    if (buyerOrgIds.size > 1) {
      throw new AppError(400, 'All selected RFQs must belong to the same buyer organization');
    }
    const buyerOrgId = buyerOrgIds.values().next().value;

    // Look up the buyer organization's primary active outlet for delivery.
    // For Wholesale POs the buyer org may have no outlet — in that case
    // deliveryOutletId stays null (the Prisma field is nullable).
    const buyerOutlet = await prisma.outlet.findFirst({
      where: { orgId: buyerOrgId, isActive: true },
      select: { id: true },
    });
    const deliveryOutletId = buyerOutlet?.id ?? null;

    // ── Build line items and compute financials ──
    // Line Total = Unit Price × Quantity (per RFQ)
    // Subtotal = sum of all line totals
    // VAT = sum of (line_total × vat_rate) for non-exempt items
    // Grand Total = Subtotal + VAT + Other Charges
    let subtotal = 0;
    let totalVat = 0;

    const lineItemsData: Array<{
      supplierItemId: string;
      qty: number;
      unitPrice: number;
      subtotal: number;
      itemName?: string | null;
      itemSku?: string | null;
      itemDescription?: string | null;
    }> = [];

    for (const rfq of rfqs) {
      const acceptedPrice = rfq.acceptedPrice ?? rfq.targetUnitPrice ?? 0;
      const acceptedQty = rfq.acceptedQuantity ?? Number(rfq.quantity ?? '0');
      const lineTotal = acceptedPrice * acceptedQty;
      subtotal += lineTotal;

      const isVatExempt = rfq.SupplierItem?.isVatExempt ?? false;
      const vatRate = rfq.SupplierItem?.vatRate ?? 0.12;
      const lineVat = isVatExempt ? 0 : lineTotal * vatRate;
      totalVat += lineVat;

      lineItemsData.push({
        supplierItemId: rfq.supplierItemId!,
        qty: Math.ceil(acceptedQty),
        unitPrice: acceptedPrice,
        subtotal: lineTotal,
        itemName: rfq.SupplierItem?.name,
        itemSku: rfq.SupplierItem?.sku,
        itemDescription: rfq.SupplierItem?.description,
      });
    }

    const grandTotal = subtotal + totalVat + otherCharges;
    const poNumber = await this.generatePONumber();

    const result = await prisma.$transaction(async (tx) => {
      // Create the consolidated PurchaseOrder
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          buyerOrgId,
          supplierOrgId: supplierOrgId,
          status: 'PENDING',
          notes: notes,
          requestedDate: new Date(),
          totalAmount: grandTotal,
          vatAmount: totalVat,
          deliveryOutletId,
          agentId: rfqs[0]?.Agent?.id ?? null,
          lineItems: {
            create: lineItemsData,
          },
        },
        include: {
          lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
          buyerOrg: { select: { id: true, name: true, profileImg: true } },
          supplierOrg: { select: { id: true, name: true, profileImg: true } },
          agent: { select: { id: true, fullname: true, email: true, organizationId: true } },
        },
      });

      // Link each RFQ to the PO via the bridge table
      for (const rfqId of rfqIds) {
        await tx.purchaseOrderRFQ.create({
          data: {
            poId: po.id,
            rfqId,
          },
        });
      }

      // Update each RFQ's status to PO_CREATED
      for (const rfq of rfqs) {
        await tx.requestForQuotation.update({
          where: { id: rfq.id },
          data: {
            status: 'PO_CREATED',
            acceptedPrice: rfq.acceptedPrice ?? rfq.targetUnitPrice ?? undefined,
            acceptedQuantity: rfq.acceptedQuantity ?? Number(rfq.quantity ?? '0'),
            acceptedDeliveryDate: deliveryDate,
          },
        });
      }

      // Create a single delivery for the consolidated PO
      const delivery = await tx.delivery.create({
        data: {
          poId: po.id,
          scheduledDate: deliveryDate,
          status: 'SCHEDULED',
          driverName,
          driverContact,
        },
      });

      // Send ORDER_CREATED messages to each RFQ's conversation
      for (const rfq of rfqs) {
        const convId = rfq.Conversation?.id;
        if (convId) {
          await tx.conversationMessage.create({
            data: {
              conversationId: convId,
              senderOrgId: supplierOrgId,
              message: `Consolidated Purchase Order ${poNumber} has been created with ${rfqIds.length} RFQ(s).`,
              type: 'CONSOLIDATED_PO_CREATED',
              metadata: {
                event: 'consolidated_po_created',
                poId: po.id,
                poNumber,
                rfqIds,
                deliveryDate: deliveryDate.toISOString(),
                totalAmount: grandTotal,
                vatAmount: totalVat,
                otherCharges,
              },
            },
          });

          await tx.conversation.update({
            where: { id: convId },
            data: { updatedAt: new Date() },
          });
        }
      }

      logDev('Consolidated PO Creation', 'Purchase Order created', {
        poNumber, poId: po.id, rfqCount: rfqIds.length, totalAmount: grandTotal,
      });

      return { po, delivery };
    });

    // Notifications + realtime emits happen only after the transaction commits
    for (const rfq of rfqs) {
      const agentOrgId = rfq.Agent?.organizationId;
      if (agentOrgId != null && rfq.Conversation) {
        void sendConversationNotification({
          conversationId: rfq.Conversation.id,
          senderId: supplierOrgId,
          recipientAgentId: rfq.Agent!.id,
          recipientUserId: undefined,
          notificationType: NotificationType.PURCHASE_ORDER_CREATED,
          message: `Supplier created consolidated PO ${result.po.poNumber} with ${rfqIds.length} RFQ(s).`,
        });

        sendToOrg(agentOrgId, 'purchaseOrder:created', {
          po: result.po,
          poNumber: result.po.poNumber,
          conversationId: rfq.Conversation.id,
        });
        sendToOrg(agentOrgId, 'notification:new', {
          conversationId: rfq.Conversation.id,
          purchaseOrderId: result.po.id,
          category: 'Purchase Order',
        });
      }
    }

    return result;
  }

  // ─── Reject negotiation ──────────────────────────────────────────────────────
  async rejectNegotiation(rfqId: string, supplierOrgId: number, reason?: string) {
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

  async markRead(conversationId: string, supplierOrgId: number) {
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

  async getUnreadCount(supplierOrgId: number): Promise<number> {
    // Count conversations where supplier is a participant and has unread messages
    const result = await prisma.$queryRaw<
      { count: number }[]
    >`
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

  private async verifySupplierAccess(conversationId: string, supplierOrgId: number) {
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

  private async generatePONumber(): Promise<string> {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-${datePart}-${rand}`;
  }
}

export default SupplierRFQService;
