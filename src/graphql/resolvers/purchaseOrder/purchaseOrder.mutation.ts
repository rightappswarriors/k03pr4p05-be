import { extendType, nonNull, stringArg, intArg, nullable, list, arg, inputObjectType } from 'nexus'
import { PrismaClient } from '@prisma/client'
import { sendNewPONotificationEmail, sendPOStatusEmail } from '../../../services/email/kompraSupplier.email.js'
import { sendToOrg, sendToConversation } from '../../../lib/ws.js'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js'
import { persistBusinessNotification, publishBusinessNotification } from '../../../services/notification.service.js'
import { hasConfirmedDeliveryLocation, inspectPurchaseOrderFunding, isPurchaseOrderFundingSatisfied } from '../../../services/purchaseOrderPolicy.service.js'
import { deliveryDateNotAgreedError, enqueueDeliveryAgreementTimeout, nextSupplierProposalDeadline, supplierAcceptRetailerPurchaseOrderDeliveryDate, supplierProposePurchaseOrderDeliveryDate } from '../../../services/purchaseOrderDeliveryAgreement.service.js'

export const POLineItemInput = inputObjectType({
  name: 'POLineItemInput',
  definition(t) {
    t.nonNull.string('supplierItemId')
    t.nonNull.int('qty')
  },
})

export const AcceptPurchaseOrderInput = inputObjectType({
  name: 'AcceptPurchaseOrderInput',
  definition(t) {
    t.nonNull.string('purchaseOrderId')
    t.nonNull.field('expectedDeliveryDate', { type: 'DateTime' })
    t.string('driverName')
    t.string('driverContact')
    t.string('supplierNote')
  },
})

export const RejectPurchaseOrderInput = inputObjectType({
  name: 'RejectPurchaseOrderInput',
  definition(t) {
    t.nonNull.string('purchaseOrderId')
    t.nonNull.string('rejectionReason')
  },
})

function generatePONumber(): string {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `PO-${datePart}-${rand}`
}

async function transitionSupplierFulfillment(ctx: any, purchaseOrderId: string, expectedStatus: string, nextStatus: string, eventType: any, realtimeEvent: string, deliveryData: Record<string, unknown> = {}) {
  requireAuth(ctx)
  PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
  const supplierOrgId = ctx.user!.orgId
  if (!supplierOrgId) throw new Error('You are not authorized to update this purchase order.')
  const po = await ctx.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { delivery: true } })
  if (!po || po.supplierOrgId !== supplierOrgId) throw new Error('You are not authorized to update this purchase order.')
  if (po.status === 'REJECTED' || po.status === 'CANCELLED' || po.status === 'COMPLETED') throw new Error('This purchase order can no longer be fulfilled.')
  if (po.status !== expectedStatus) throw new Error(`This order must be ${expectedStatus.replaceAll('_', ' ').toLowerCase()} before this action.`)
  if (po.supplierConfirmation !== 'CONFIRMED') throw new Error('Supplier confirmation is required before fulfillment can continue.')
  if (!hasConfirmedDeliveryLocation(po.delivery)) throw new Error('The buyer must confirm the delivery address before fulfillment can continue.')
  if (po.source === 'DIRECT_ORDER' && ['READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(nextStatus) && po.deliveryDateAgreementStatus !== 'AGREED') throw deliveryDateNotAgreedError(nextStatus === 'IN_TRANSIT' ? 'dispatched' : 'marked ready for dispatch')
  const funding = await inspectPurchaseOrderFunding(ctx.prisma, po)
  if (funding.latestPayment?.status === 'RECONCILIATION_REQUIRED' && funding.classification !== 'PREPAID_PAID') throw new Error('Payment is awaiting reconciliation and cannot enter fulfillment yet.')
  if (!isPurchaseOrderFundingSatisfied(po, funding.authoritativePayment)) throw new Error('Payment requirements must be satisfied before fulfillment can continue.')
  const timestamp = new Date()
  const updated = await ctx.prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${po.id} FOR UPDATE`
    const current = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { delivery: true } })
    if (current.status !== expectedStatus) throw new Error('This order changed before the fulfillment action could be completed. Refresh and try again.')
    const cancellation = await tx.purchaseOrderCancellation.findUnique({ where: { purchaseOrderId: po.id } })
    if (cancellation?.status === 'REQUESTED') throw new Error('Resolve the pending cancellation request before continuing fulfillment.')
    const refund = await tx.paymentRefund.findUnique({ where: { purchaseOrderId: po.id }, select: { id: true } })
    if (refund) throw new Error('Fulfillment cannot continue while this order has a refund record.')
    if (!hasConfirmedDeliveryLocation(current.delivery)) throw new Error('The buyer must confirm the delivery address before fulfillment can continue.')
    if (current.source === 'DIRECT_ORDER' && ['READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(nextStatus) && current.deliveryDateAgreementStatus !== 'AGREED') throw deliveryDateNotAgreedError(nextStatus === 'IN_TRANSIT' ? 'dispatched' : 'marked ready for dispatch')
    const currentFunding = await inspectPurchaseOrderFunding(tx, current)
    if (currentFunding.latestPayment?.status === 'RECONCILIATION_REQUIRED' && currentFunding.classification !== 'PREPAID_PAID') throw new Error('Payment is awaiting reconciliation and cannot enter fulfillment yet.')
    if (!isPurchaseOrderFundingSatisfied(current, currentFunding.authoritativePayment)) throw new Error('Payment requirements must be satisfied before fulfillment can continue.')
    const transitioned = await tx.purchaseOrder.updateMany({ where: { id: po.id, supplierOrgId, status: expectedStatus, ...(current.source === 'DIRECT_ORDER' && ['READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(nextStatus) ? { deliveryDateAgreementStatus: 'AGREED' } : {}) }, data: { status: nextStatus, ...(nextStatus === 'READY_FOR_DISPATCH' ? { readyForDispatchAt: timestamp } : {}), ...(nextStatus === 'IN_TRANSIT' ? { dispatchedAt: timestamp } : {}) } })
    if (transitioned.count !== 1) throw new Error('This order can no longer make that fulfillment transition.')
    if (nextStatus === 'IN_TRANSIT' || nextStatus === 'DELIVERED') await tx.delivery.update({ where: { poId: po.id }, data: { ...(nextStatus === 'IN_TRANSIT' ? { status: 'IN_TRANSIT' } : { status: 'DELIVERED', deliveredAt: timestamp }), ...deliveryData } })
    const result = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })
    if (result.conversationId) await tx.conversationMessage.create({ data: { conversationId: result.conversationId, senderOrgId: supplierOrgId, type: eventType, message: nextStatus.replaceAll('_', ' '), metadata: { event: eventType, poId: result.id, poNumber: result.poNumber, timestamp: timestamp.toISOString(), ...deliveryData } } })
    return result
  }, { isolationLevel: 'Serializable' })
  const payload = { poId: updated.id, poNumber: updated.poNumber, status: updated.status, timestamp: timestamp.toISOString(), ...deliveryData }
  if (updated.buyerOrgId) sendToOrg(updated.buyerOrgId, realtimeEvent as any, payload)
  sendToOrg(updated.supplierOrgId, realtimeEvent as any, payload)
  if (updated.conversationId) sendToConversation(updated.conversationId, 'conversation:newMessage' as any, { conversationId: updated.conversationId, type: eventType, message: updated.status.replaceAll('_', ' '), createdAt: timestamp.toISOString(), metadata: payload })
  return updated
}

// ─── Ensure PO conversation (get-or-create, idempotent) ─────────────────────────
// Creates a dedicated ORDER conversation for the PO if one does not exist yet.
// Returns the conversationId — reused by createPurchaseOrder and startPOConversation.
async function ensurePOConversation(
  client: PrismaClient,
  po: {
    id: string
    poNumber: string
    supplierOrgId: number
    buyerOrgId?: number | null
    agentId?: string | null
    totalAmount: number
    vatAmount: number
    lineItems: { id: string }[]
  },
): Promise<string> {
  const existing = await client.purchaseOrder.findUnique({
    where: { id: po.id },
    select: { conversationId: true },
  })
  if (existing?.conversationId) {
    return existing.conversationId
  }

  const participants = [
    ...(po.agentId ? [{ agentId: po.agentId, role: 'AGENT' as const }] : []),
    ...(po.buyerOrgId ? [{ organizationId: po.buyerOrgId, role: 'AGENT' as const }] : []),
    { organizationId: po.supplierOrgId, role: 'SUPPLIER' as const },
  ]

  const conv = await client.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        poId: po.id,
        type: 'ORDER',
        ConversationParticipant: {
          create: participants,
        },
      },
    })

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { conversationId: conversation.id },
    })

    await tx.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        senderOrgId: po.supplierOrgId,
        message: `Purchase Order ${po.poNumber} has been created.`,
        type: 'ORDER_CREATED',
        metadata: {
          event: 'po_created',
          poId: po.id,
          poNumber: po.poNumber,
          buyerOrgId: po.buyerOrgId,
          totalAmount: po.totalAmount,
          vatAmount: po.vatAmount,
          itemCount: po.lineItems.length,
        },
      },
    })

    return conversation
  })

  return conv.id
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
        const poNumber = generatePONumber()

        let subtotalAmount = 0
        let vatAmount = 0
        const enrichedLines: Array<{ supplierItemId: string; qty: number; unitPrice: number; subtotal: number }> = []

        for (const li of lineItems) {
          const item = await ctx.prisma.supplierItem.findUniqueOrThrow({
            where: { id: li.supplierItemId },
            include: { priceTiers: { orderBy: { minQty: 'desc' } } },
          })

          let unitPrice = item.unitPrice
          for (const tier of item.priceTiers) {
            if (li.qty >= tier.minQty) {
              unitPrice = tier.price
              break
            }
          }

          const subtotal = unitPrice * li.qty
          const vat = item.isVatExempt ? 0 : subtotal * item.vatRate
          subtotalAmount += subtotal
          vatAmount += vat
          enrichedLines.push({ supplierItemId: li.supplierItemId, qty: li.qty, unitPrice, subtotal })
        }

        const po = await ctx.prisma.purchaseOrder.create({
          data: {
            poNumber,
            supplierOrgId,
            buyerOrgId,
            source: 'DIRECT_ORDER',
            supplierConfirmation: 'REVIEW_REQUIRED',
            outletId,
            notes,
            requestedDate,
            subtotalAmount,
            extraCharges: [],
            extraChargesTotal: 0,
            totalAmount: subtotalAmount + vatAmount,
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
        })

        const supplierUser = await ctx.prisma.user.findFirst({
          where: { organizationId: supplierOrgId },
          select: { email: true },
        })
        if (supplierUser?.email) {
          sendNewPONotificationEmail(
            supplierUser.email,
            poNumber,
            po.buyerOrg.name,
            subtotalAmount + vatAmount
          ).catch(() => {})
        }

        // Create the PO conversation (idempotent — no-op if already linked)
        const convId = await ensurePOConversation(ctx.prisma, {
          id: po.id,
          poNumber,
          supplierOrgId,
          buyerOrgId,
          totalAmount: subtotalAmount + vatAmount,
          vatAmount,
          lineItems: po.lineItems,
        })

        // Notify the buyer org that a new PO was placed
        sendToOrg(buyerOrgId, 'purchaseOrder:created' as any, {
          poId: po.id,
          poNumber,
          buyerOrgId,
          supplierOrgId,
        })
        sendToConversation(convId, 'conversation:newMessage' as any, {
          conversationId: convId,
          poId: po.id,
          poNumber,
          senderOrgId: supplierOrgId,
          message: `Purchase Order ${poNumber} has been created.`,
          type: 'ORDER_CREATED',
          createdAt: new Date().toISOString(),
          metadata: { event: 'po_created', poId: po.id, poNumber, subtotalAmount, totalAmount: subtotalAmount + vatAmount, vatAmount },
        })

        return po
      },
    })

    t.nonNull.field('acceptPO', {
      type: 'PurchaseOrder',
      args: {
        id: nonNull(stringArg()),
        expectedDeliveryDate: nonNull(arg({ type: 'DateTime' })),
        driverName: nullable(stringArg()),
        driverContact: nullable(stringArg()),
        supplierNote: nullable(stringArg()),
      },
      resolve: async (_, { id, expectedDeliveryDate, driverName, driverContact, supplierNote }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
        const supplierOrgId = ctx.user!.orgId
        if (!supplierOrgId) throw new Error('A supplier organization is required to accept a purchase order.')
        const existing = await ctx.prisma.purchaseOrder.findUniqueOrThrow({ where: { id } })
        if (existing.supplierOrgId !== supplierOrgId) throw new Error('You do not have permission to accept this purchase order.')
        if (existing.paymentStatus === 'PAID') throw new Error('Paid purchase orders cannot be changed.')
        if (existing.supplierConfirmation !== 'REVIEW_REQUIRED') throw new Error('This purchase order has already been reviewed by the supplier.')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        if (expectedDeliveryDate < today) throw new Error('The expected delivery date cannot be in the past.')
        const proposalStartedAt = new Date()
        const proposalDeadline = nextSupplierProposalDeadline({ ...existing, status: 'SUPPLIER_ACCEPTED' }, proposalStartedAt)
        const po = await ctx.prisma.$transaction(async (tx) => {
          await tx.delivery.upsert({
            where: { poId: id },
            create: {
              poId: id,
              scheduledDate: expectedDeliveryDate,
              status: 'SCHEDULED',
              driverName: driverName?.trim() || null,
              driverContact: driverContact?.trim() || null,
            },
            update: {
              scheduledDate: expectedDeliveryDate,
              driverName: driverName?.trim() || null,
              driverContact: driverContact?.trim() || null,
            },
          })
          return tx.purchaseOrder.update({
            where: { id },
            data: {
              status: 'SUPPLIER_ACCEPTED',
              supplierConfirmation: 'CONFIRMED',
              supplierConfirmedAt: new Date(),
              supplierExpectedDeliveryAt: expectedDeliveryDate,
              deliveryDateAgreementStatus: existing.source === 'DIRECT_ORDER' ? 'PENDING_BUYER' : existing.requestedDate && existing.requestedDate.getTime() === expectedDeliveryDate.getTime() ? 'AGREED' : 'PENDING_BUYER',
              deliveryDateAgreedAt: existing.source === 'DIRECT_ORDER' ? null : existing.requestedDate && existing.requestedDate.getTime() === expectedDeliveryDate.getTime() ? new Date() : null,
              deliveryDateAgreementMethod: existing.source === 'DIRECT_ORDER' ? null : existing.requestedDate && existing.requestedDate.getTime() === expectedDeliveryDate.getTime() ? 'SUPPLIER_ACCEPTED' : null,
              ...(existing.source === 'DIRECT_ORDER' ? proposalDeadline : { deliveryDateResponseDeadlineAt: null }),
              supplierNote: supplierNote?.trim() || null,
            },
            include: {
              lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
              delivery: true,
              buyerOrg: true,
              supplierOrg: true,
              outlet: true,
            },
          })
        }, { isolationLevel: 'Serializable' })

        const buyerUser = await ctx.prisma.user.findFirst({
          where: { organizationId: po.buyerOrgId },
          select: { email: true },
        })
        if (buyerUser?.email) {
          sendPOStatusEmail(buyerUser.email, po.poNumber, 'ACCEPTED').catch(() => {})
        }

        // Emit realtime events for PO acceptance
        sendToOrg(po.buyerOrgId, 'purchaseOrder:accepted' as any, { poId: po.id, poNumber: po.poNumber })
        if (po.conversationId) {
          sendToConversation(po.conversationId, 'conversation:newMessage' as any, {
            conversationId: po.conversationId,
            poId: po.id,
            poNumber: po.poNumber,
            type: 'PO_ACCEPTED',
          message: `Purchase Order ${po.poNumber} has been accepted.`,
          createdAt: new Date().toISOString(),
          metadata: { event: 'PO_ACCEPTED', poId: po.id, poNumber: po.poNumber, expectedDeliveryDate, driverName: driverName?.trim() || null, driverContact: driverContact?.trim() || null, supplierNote: supplierNote?.trim() || null },
          })
        }

        if (po.deliveryDateResponseDeadlineAt && po.supplierExpectedDeliveryAt) {
          void enqueueDeliveryAgreementTimeout({ purchaseOrderId: po.id, proposalVersion: po.deliveryDateProposalVersion, deadline: po.deliveryDateResponseDeadlineAt, supplierProposal: po.supplierExpectedDeliveryAt }).catch(() => {})
        }

        return po
      },
    })

    t.nonNull.field('acceptPurchaseOrder', {
      type: 'PurchaseOrder',
      args: { input: nonNull(arg({ type: 'AcceptPurchaseOrderInput' })) },
      resolve: async (_, { input }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
        const supplierOrgId = ctx.user!.orgId
        if (!supplierOrgId) throw new Error('A supplier organization is required to accept a purchase order.')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        if (input.expectedDeliveryDate < today) throw new Error('The expected delivery date cannot be in the past.')
        const result = await ctx.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${input.purchaseOrderId} FOR UPDATE`
          const existing = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.purchaseOrderId } })
          if (existing.supplierOrgId !== supplierOrgId) throw new Error('Purchase order not found.')
          if (existing.supplierConfirmation === 'CONFIRMED' && ['SUPPLIER_ACCEPTED', 'ACCEPTED'].includes(existing.status) && existing.supplierExpectedDeliveryAt) return { po: existing, notification: null, message: null }
          const repairingLegacyCommitment = existing.supplierConfirmation === 'CONFIRMED' && !existing.supplierExpectedDeliveryAt && existing.paymentStatus === 'PENDING'
          const explicitLegacyReview = existing.status === 'ACCEPTED' && existing.supplierConfirmation === 'REVIEW_REQUIRED'
          const normalReview = existing.status === 'PENDING' && existing.supplierConfirmation === 'REVIEW_REQUIRED' && existing.paymentStatus !== 'PAID'
          if (!normalReview && !explicitLegacyReview && !repairingLegacyCommitment) throw new Error('This purchase order can no longer be reviewed.')
          const cancellation = await tx.purchaseOrderCancellation.findUnique({ where: { purchaseOrderId: existing.id }, select: { status: true } })
          if (cancellation?.status === 'REQUESTED') throw new Error('Resolve the pending cancellation request before accepting this purchase order.')
          const refund = await tx.paymentRefund.findUnique({ where: { purchaseOrderId: existing.id }, select: { id: true } })
          if (refund) throw new Error('This purchase order cannot be accepted while it has a refund record.')
          if (!existing.buyerOrgId) throw new Error('This purchase order has no Retailer organization to approve its delivery schedule.')
          const proposalStartedAt = new Date()
          const proposalDeadline = nextSupplierProposalDeadline({ ...existing, status: 'SUPPLIER_ACCEPTED' }, proposalStartedAt)
          await tx.delivery.upsert({
            where: { poId: existing.id },
            create: { poId: existing.id, scheduledDate: input.expectedDeliveryDate, status: 'SCHEDULED', driverName: input.driverName?.trim() || null, driverContact: input.driverContact?.trim() || null },
            update: { scheduledDate: input.expectedDeliveryDate, driverName: input.driverName?.trim() || null, driverContact: input.driverContact?.trim() || null },
          })
          const updated = await tx.purchaseOrder.update({
            where: { id: existing.id },
            data: {
              status: 'SUPPLIER_ACCEPTED',
              supplierConfirmation: 'CONFIRMED',
              supplierConfirmedAt: proposalStartedAt,
              supplierExpectedDeliveryAt: input.expectedDeliveryDate,
              deliveryDateAgreementStatus: existing.source === 'DIRECT_ORDER' ? 'PENDING_BUYER' : existing.requestedDate && existing.requestedDate.getTime() === input.expectedDeliveryDate.getTime() ? 'AGREED' : 'PENDING_BUYER',
              deliveryDateAgreedAt: existing.source === 'DIRECT_ORDER' ? null : existing.requestedDate && existing.requestedDate.getTime() === input.expectedDeliveryDate.getTime() ? new Date() : null,
              deliveryDateAgreementMethod: existing.source === 'DIRECT_ORDER' ? null : existing.requestedDate && existing.requestedDate.getTime() === input.expectedDeliveryDate.getTime() ? 'SUPPLIER_ACCEPTED' : null,
              ...(existing.source === 'DIRECT_ORDER' ? proposalDeadline : { deliveryDateResponseDeadlineAt: null }),
              supplierNote: input.supplierNote?.trim() || null,
            },
          })
          const persisted = await persistBusinessNotification(tx, {
            orgId: updated.buyerOrgId,
            outletId: updated.deliveryOutletId,
            conversationId: updated.conversationId,
            type: 'NEW_TRANSACTION',
            title: 'Delivery schedule requires your response',
            referenceType: 'PURCHASE_ORDER',
            referenceId: updated.id,
            message: updated.deliveryDateResponseDeadlineAt
              ? `Purchase Order ${updated.poNumber} was accepted. Respond to the Supplier's proposed delivery schedule by ${updated.deliveryDateResponseDeadlineAt.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}.`
              : `Purchase Order ${updated.poNumber} was accepted. Its delivery agreement requires account review.`,
          })
          const message = updated.conversationId ? await tx.conversationMessage.create({ data: { conversationId: updated.conversationId, senderOrgId: supplierOrgId, type: 'PO_ACCEPTED', message: `Supplier accepted Purchase Order ${updated.poNumber} and proposed delivery for ${input.expectedDeliveryDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}.`, metadata: { event: 'PO_ACCEPTED', poId: updated.id, expectedDeliveryDate: input.expectedDeliveryDate.toISOString(), deliveryDateAgreementStatus: updated.deliveryDateAgreementStatus, proposalVersion: updated.deliveryDateProposalVersion, responseDeadlineAt: updated.deliveryDateResponseDeadlineAt?.toISOString() ?? null } } }) : null
          return { po: updated, notification: persisted.created ? persisted.notification : null, message }
        }, { isolationLevel: 'Serializable' })
        const po = result.po
        publishBusinessNotification(result.notification)
        if (po.buyerOrgId) sendToOrg(po.buyerOrgId, 'purchaseOrder:accepted' as any, { poId: po.id, poNumber: po.poNumber })
        if (po.conversationId && result.message) sendToConversation(po.conversationId, 'conversation:newMessage' as any, { ...result.message, createdAt: result.message.createdAt.toISOString() })
        if (po.deliveryDateResponseDeadlineAt && po.supplierExpectedDeliveryAt) {
          void enqueueDeliveryAgreementTimeout({ purchaseOrderId: po.id, proposalVersion: po.deliveryDateProposalVersion, deadline: po.deliveryDateResponseDeadlineAt, supplierProposal: po.supplierExpectedDeliveryAt }).catch((error) => {
            if (process.env.NODE_ENV === 'development') console.warn('[Delivery agreement] delayed job unavailable; recovery scan remains active.', error)
          })
        }
        return po
      },
    })

    t.nonNull.field('proposePurchaseOrderDeliveryDate', {
      type: 'PurchaseOrder',
      args: {
        purchaseOrderId: nonNull(stringArg()),
        expectedDeliveryDate: nonNull(arg({ type: 'DateTime' })),
      },
      resolve: (_, { purchaseOrderId, expectedDeliveryDate }, ctx) => supplierProposePurchaseOrderDeliveryDate(ctx, purchaseOrderId, expectedDeliveryDate),
    })

    t.nonNull.field('acceptRetailerPurchaseOrderDeliveryDate', {
      type: 'PurchaseOrder',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: (_, { purchaseOrderId }, ctx) => supplierAcceptRetailerPurchaseOrderDeliveryDate(ctx, purchaseOrderId),
    })

    t.nonNull.field('rejectPO', {
      type: 'PurchaseOrder',
      args: {
        id: nonNull(stringArg()),
        reason: nonNull(stringArg()),
      },
      resolve: async (_, { id, reason }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
        const supplierOrgId = ctx.user!.orgId
        if (!supplierOrgId) throw new Error('A supplier organization is required to decline a purchase order.')
        if (!reason.trim()) throw new Error('A decline reason is required.')
        const existing = await ctx.prisma.purchaseOrder.findUniqueOrThrow({ where: { id } })
        if (existing.supplierOrgId !== supplierOrgId) throw new Error('You do not have permission to decline this purchase order.')
        if (existing.paymentStatus === 'PAID') throw new Error('Paid purchase orders cannot be declined.')
        if (existing.supplierConfirmation !== 'REVIEW_REQUIRED') throw new Error('This purchase order has already been reviewed by the supplier.')
        const po = await ctx.prisma.purchaseOrder.update({
          where: { id },
          data: { status: 'REJECTED', supplierConfirmation: 'DECLINED', rejectionReason: reason.trim(), deliveryDateResponseDeadlineAt: null, deliveryDateAgreementMethod: null },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
            outlet: true,
          },
        })

        const buyerUser = await ctx.prisma.user.findFirst({
          where: { organizationId: po.buyerOrgId },
          select: { email: true },
        })
        if (buyerUser?.email) {
          sendPOStatusEmail(buyerUser.email, po.poNumber, 'REJECTED').catch(() => {})
        }

        // Emit realtime events for PO rejection
        sendToOrg(po.buyerOrgId, 'purchaseOrder:rejected' as any, { poId: po.id, poNumber: po.poNumber })
        if (po.conversationId) {
          sendToConversation(po.conversationId, 'conversation:newMessage' as any, {
            conversationId: po.conversationId,
            poId: po.id,
            poNumber: po.poNumber,
            type: 'PO_REJECTED',
            message: `Purchase Order ${po.poNumber} has been rejected.`,
            createdAt: new Date().toISOString(),
          metadata: { event: 'PO_DECLINED', poId: po.id, poNumber: po.poNumber, reason: reason.trim() },
          })
        }

        return po
      },
    })

    t.nonNull.field('rejectPurchaseOrder', {
      type: 'PurchaseOrder',
      args: { input: nonNull(arg({ type: 'RejectPurchaseOrderInput' })) },
      resolve: async (_, { input }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
        const supplierOrgId = ctx.user!.orgId
        if (!supplierOrgId) throw new Error('A supplier organization is required to decline a purchase order.')
        if (!input.rejectionReason.trim()) throw new Error('A decline reason is required.')
        const existing = await ctx.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: input.purchaseOrderId } })
        if (existing.supplierOrgId !== supplierOrgId) throw new Error('You do not have permission to decline this purchase order.')
        if (existing.paymentStatus === 'PAID' || existing.supplierConfirmation !== 'REVIEW_REQUIRED') throw new Error('This purchase order can no longer be reviewed.')
        let notification: any = null
        const po = await ctx.prisma.$transaction(async (tx) => {
          const updated = await tx.purchaseOrder.update({ where: { id: existing.id }, data: { status: 'REJECTED', supplierConfirmation: 'DECLINED', rejectionReason: input.rejectionReason.trim(), deliveryDateResponseDeadlineAt: null, deliveryDateAgreementMethod: null } })
          const persisted = await persistBusinessNotification(tx, {
            orgId: updated.buyerOrgId,
            outletId: updated.deliveryOutletId,
            conversationId: updated.conversationId,
            type: 'NEW_TRANSACTION',
            title: 'Purchase order declined',
            message: `Purchase Order ${updated.poNumber} was declined by the Supplier.`,
            referenceType: 'PURCHASE_ORDER',
            referenceId: updated.id,
          })
          if (persisted.created) notification = persisted.notification
          return updated
        })
        publishBusinessNotification(notification)
        if (po.buyerOrgId) sendToOrg(po.buyerOrgId, 'purchaseOrder:rejected' as any, { poId: po.id, poNumber: po.poNumber, reason: po.rejectionReason })
        if (po.conversationId) sendToConversation(po.conversationId, 'conversation:newMessage' as any, { conversationId: po.conversationId, poId: po.id, poNumber: po.poNumber, type: 'PO_REJECTED', message: `Purchase Order ${po.poNumber} has been rejected.`, createdAt: new Date().toISOString(), metadata: { event: 'PO_REJECTED', poId: po.id, reason: po.rejectionReason } })
        return po
      },
    })

    t.nonNull.field('preparePurchaseOrder', {
      type: 'PurchaseOrder',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: async (_, { purchaseOrderId }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
        const supplierOrgId = ctx.user!.orgId
        if (!supplierOrgId) throw new Error('You are not authorized to prepare this purchase order.')

        const po = await ctx.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { delivery: true } })
        if (!po || po.supplierOrgId !== supplierOrgId) throw new Error('You are not authorized to prepare this purchase order.')
        if (po.status === 'REJECTED') throw new Error('Rejected orders cannot be prepared.')
        if (po.status === 'CANCELLED') throw new Error('Cancelled orders cannot be prepared.')
        if (po.status === 'PREPARING') throw new Error('This order is already being prepared.')
        if (po.supplierConfirmation !== 'CONFIRMED') throw new Error('Supplier confirmation is required before the order can be prepared.')
        if (!hasConfirmedDeliveryLocation(po.delivery)) throw new Error('The buyer must confirm the delivery address before the order can be prepared.')
        if (po.source === 'DIRECT_ORDER' && po.deliveryDateAgreementStatus !== 'AGREED') throw deliveryDateNotAgreedError()

        const funding = await inspectPurchaseOrderFunding(ctx.prisma, po)
        if (funding.latestPayment?.status === 'RECONCILIATION_REQUIRED' && funding.classification !== 'PREPAID_PAID') throw new Error('Payment is awaiting reconciliation and cannot enter fulfillment yet.')
        if (!isPurchaseOrderFundingSatisfied(po, funding.authoritativePayment)) throw new Error('Payment requirements must be satisfied before the order can be prepared.')

        const preparedAt = new Date()
        const updated = await ctx.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${po.id} FOR UPDATE`
          const current = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { delivery: true } })
          const cancellation = await tx.purchaseOrderCancellation.findUnique({ where: { purchaseOrderId: po.id } })
          if (cancellation?.status === 'REQUESTED') throw new Error('Resolve the pending cancellation request before preparing this order.')
          const refund = await tx.paymentRefund.findUnique({ where: { purchaseOrderId: po.id }, select: { id: true } })
          if (refund) throw new Error('This order cannot be prepared while it has a refund record.')
          if (current.supplierConfirmation !== 'CONFIRMED') throw new Error('Supplier confirmation is required before the order can be prepared.')
          if (!hasConfirmedDeliveryLocation(current.delivery)) throw new Error('The buyer must confirm the delivery address before the order can be prepared.')
          if (current.source === 'DIRECT_ORDER' && current.deliveryDateAgreementStatus !== 'AGREED') throw deliveryDateNotAgreedError()
          const currentFunding = await inspectPurchaseOrderFunding(tx, current)
          if (currentFunding.latestPayment?.status === 'RECONCILIATION_REQUIRED' && currentFunding.classification !== 'PREPAID_PAID') throw new Error('Payment is awaiting reconciliation and cannot enter fulfillment yet.')
          if (!isPurchaseOrderFundingSatisfied(current, currentFunding.authoritativePayment)) throw new Error('Payment requirements must be satisfied before the order can be prepared.')
          const transitioned = await tx.purchaseOrder.updateMany({
            where: { id: po.id, supplierOrgId, status: { in: ['SUPPLIER_ACCEPTED', 'ACCEPTED'] }, supplierConfirmation: 'CONFIRMED', ...(current.source === 'DIRECT_ORDER' ? { deliveryDateAgreementStatus: 'AGREED' } : {}) },
            data: { status: 'PREPARING', preparingAt: preparedAt },
          })
          if (transitioned.count !== 1) throw new Error('This order can no longer enter preparation.')
          const preparedPo = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })
          if (preparedPo.conversationId) {
            await tx.conversationMessage.create({
              data: {
                conversationId: preparedPo.conversationId,
                senderOrgId: supplierOrgId,
                type: 'ORDER_PREPARING',
                message: 'Order Preparation Started',
                metadata: { event: 'ORDER_PREPARING', poId: preparedPo.id, poNumber: preparedPo.poNumber, preparingAt: preparedAt.toISOString() },
              },
            })
          }
          return preparedPo
        }, { isolationLevel: 'Serializable' })

        if (updated.buyerOrgId) sendToOrg(updated.buyerOrgId, 'purchaseOrder:preparing' as any, { poId: updated.id, poNumber: updated.poNumber, preparingAt: preparedAt.toISOString() })
        if (updated.conversationId) sendToConversation(updated.conversationId, 'conversation:newMessage' as any, { conversationId: updated.conversationId, poId: updated.id, poNumber: updated.poNumber, type: 'ORDER_PREPARING', message: 'Order Preparation Started', createdAt: preparedAt.toISOString(), metadata: { event: 'ORDER_PREPARING', poId: updated.id, preparingAt: preparedAt.toISOString() } })
        return updated
      },
    })
    t.nonNull.field('markPurchaseOrderReadyForDispatch', {
      type: 'PurchaseOrder', args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: (_, { purchaseOrderId }, ctx) => transitionSupplierFulfillment(ctx, purchaseOrderId, 'PREPARING', 'READY_FOR_DISPATCH', 'ORDER_READY_FOR_DISPATCH', 'purchaseOrder:readyForDispatch'),
    })
    t.nonNull.field('dispatchPurchaseOrder', {
      type: 'PurchaseOrder', args: { purchaseOrderId: nonNull(stringArg()), deliveryNote: nullable(stringArg()) },
      resolve: (_, { purchaseOrderId, deliveryNote }, ctx) => transitionSupplierFulfillment(ctx, purchaseOrderId, 'READY_FOR_DISPATCH', 'IN_TRANSIT', 'ORDER_DISPATCHED', 'purchaseOrder:dispatched', { notes: deliveryNote?.trim() || null }),
    })
    t.nonNull.field('markPurchaseOrderDelivered', {
      type: 'PurchaseOrder', args: { purchaseOrderId: nonNull(stringArg()), deliveryNote: nullable(stringArg()) },
      resolve: (_, { purchaseOrderId, deliveryNote }, ctx) => transitionSupplierFulfillment(ctx, purchaseOrderId, 'IN_TRANSIT', 'DELIVERED', 'ORDER_DELIVERED', 'purchaseOrder:delivered', { notes: deliveryNote?.trim() || null }),
    })
  },
})

// ─── Send message in PO conversation ──────────────────────────────────────

export const SendPoMessageInput = inputObjectType({
  name: 'SendPoMessageInput',
  definition(t) {
    t.nonNull.string('poId');
    t.nonNull.string('message');
    t.list.string('attachments');
    t.string('clientMessageId');
  },
})

export const SendPoMessageMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('sendPoMessage', {
      type: 'ConversationMessage',
      args: {
        input: nonNull(arg({ type: 'SendPoMessageInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        requireAuth(ctx);
        const user = ctx.user!;

        // The current Supplier or Retailer buyer may use the existing secured
        // PO conversation. Foreign organizations receive a not-found response.
        const po = await ctx.prisma.purchaseOrder.findFirst({
          where: { id: input.poId, OR: [{ supplierOrgId: user.orgId }, { buyerOrgId: user.orgId }] },
          select: { conversationId: true, supplierOrgId: true, buyerOrgId: true },
        });

        if (!po) throw new Error('Purchase order not found.');
        if (po.supplierOrgId === user.orgId) PAGE_PERMISSIONS.supplierPurchaseOrders.create(ctx);

        if (!po.conversationId) {
          throw new Error('PO has no conversation');
        }

        const msg = await ctx.prisma.conversationMessage.create({
          data: {
            conversationId: po.conversationId,
            senderOrgId: user.orgId,
            message: input.message,
            type: 'TEXT',
            attachments: input.attachments ?? [],
            ...(input.clientMessageId ? { metadata: { clientMessageId: input.clientMessageId } } : {}),
          },
          include: {
            Agent: true,
            Organization: true,
          },
        });

        // Emit realtime event to the PO conversation room
        sendToConversation(po.conversationId, 'conversation:newMessage', {
          id: msg.id,
          conversationId: po.conversationId,
          senderOrgId: user.orgId,
          message: msg.message,
          type: msg.type,
          createdAt: msg.createdAt.toISOString(),
          attachments: msg.attachments,
        });

        return msg;
      },
    })
  },
})

// ─── PO receipt upload ──────────────────────────────────────────────────────

export const SendPoReceiptInput = inputObjectType({
  name: 'SendPoReceiptInput',
  definition(t) {
    t.nonNull.string('poId')
    t.string('receiptId')
    t.nonNull.float('totalAmount')
    t.nonNull.string('paymentMethod')
    t.string('paymentReference')
    t.nullable.field({ type: 'DateTime', name: 'paidAt' })
    t.string('pdfUrl')
  },
})

export const PoReceiptMutation = extendType({
  type: 'Mutation',
  definition(t) {
    // Scenario B: start a conversation on an existing PO (idempotent)
    t.nullable.field('startPOConversation', {
      type: 'Conversation',
      args: {
        poId: nonNull(stringArg()),
      },
      resolve: async (_, { poId }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.create(ctx)
        const user = ctx.user!
        const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({
          where: { id: poId, supplierOrgId: user.orgId },
          select: {
            id: true,
            poNumber: true,
            supplierOrgId: true,
            buyerOrgId: true,
            agentId: true,
            totalAmount: true,
          vatAmount: true,
          subtotalAmount: true,
          extraCharges: true,
          extraChargesTotal: true,
            lineItems: { select: { id: true } },
          },
        })
        const convId = await ensurePOConversation(ctx.prisma, {
          id: po.id,
          poNumber: po.poNumber,
          supplierOrgId: po.supplierOrgId,
          buyerOrgId: po.buyerOrgId,
          agentId: po.agentId,
          totalAmount: po.totalAmount,
          vatAmount: po.vatAmount,
          lineItems: po.lineItems,
        })
        sendToConversation(convId, 'conversation:newMessage' as any, {
          conversationId: convId,
          poId: po.id,
          senderOrgId: user.orgId,
          message: `Conversation started for Purchase Order ${po.poNumber}.`,
          type: 'ORDER_CREATED',
          createdAt: new Date().toISOString(),
          metadata: { event: 'conversation_started', poId: po.id, poNumber: po.poNumber },
        })
        return ctx.prisma.conversation.findUnique({ where: { id: convId } })
      },
    })

    // Scenario C: upload a receipt snapshot and post RECEIPT_UPLOADED event
    t.nonNull.field('sendPoReceipt', {
      type: 'PurchaseOrder',
      args: {
        input: nonNull(arg({ type: 'SendPoReceiptInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
        const user = ctx.user!
        const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({
          where: { id: input.poId, supplierOrgId: user.orgId },
          select: {
            id: true,
            poNumber: true,
            supplierOrgId: true,
            buyerOrgId: true,
            agentId: true,
            totalAmount: true,
            vatAmount: true,
            subtotalAmount: true,
            extraCharges: true,
            extraChargesTotal: true,
            conversationId: true,
            lineItems: { select: { id: true } },
          },
        })

        // Ensure conversation exists (Scenario B fallback)
        let convId = po.conversationId
        if (!convId) {
          convId = await ensurePOConversation(ctx.prisma, {
            id: po.id,
            poNumber: po.poNumber,
            supplierOrgId: po.supplierOrgId,
            buyerOrgId: po.buyerOrgId,
            agentId: po.agentId,
            totalAmount: po.totalAmount,
            vatAmount: po.vatAmount,
            lineItems: po.lineItems,
          })
        }

        // A supplier-provided receipt is never proof of payment.  A paid receipt
        // may only be produced from an already-confirmed backend transaction.
        const payment = await ctx.prisma.paymentTransaction.findFirst({
          where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, status: 'SUCCEEDED', deletedAt: null },
          orderBy: { updatedAt: 'desc' },
        })
        if (!payment) throw new Error('A confirmed payment transaction is required before creating a paid receipt.')

        const receiptId = input.receiptId ?? `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const receiptSnapshot = JSON.stringify({
          receiptId,
          subtotalAmount: po.subtotalAmount,
          vatAmount: po.vatAmount,
          extraCharges: po.extraCharges,
          extraChargesTotal: po.extraChargesTotal,
          totalAmount: payment.amount,
          paymentMethod: po.paymentMethod,
          paymentReference: payment.gatewayReference,
          paidAt: payment.updatedAt.toISOString(),
          pdfUrl: input.pdfUrl ?? null,
        })

        const updatedPO = await ctx.prisma.purchaseOrder.update({
          where: { id: po.id },
          data: {
            receiptSnapshot: receiptSnapshot,
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
          },
        })

        // Post RECEIPT_UPLOADED system message in the PO conversation
        const receiptUrl = input.pdfUrl ?? null
        await ctx.prisma.conversationMessage.create({
          data: {
            conversationId: convId!,
            senderOrgId: user.orgId,
            message: `Receipt ${receiptId} has been uploaded for Purchase Order ${po.poNumber}.`,
            type: 'RECEIPT_UPLOADED',
            metadata: {
              event: 'receipt_uploaded',
              poId: po.id,
              poNumber: po.poNumber,
              receiptId,
              totalAmount: payment.amount,
              paymentMethod: po.paymentMethod,
              receiptUrl,
              paidAt: payment.updatedAt.toISOString(),
            },
          },
        })

        sendToConversation(convId!, 'conversation:newMessage' as any, {
          conversationId: convId!,
          poId: po.id,
          senderOrgId: user.orgId,
          message: `Receipt ${receiptId} has been uploaded for Purchase Order ${po.poNumber}.`,
          type: 'RECEIPT_UPLOADED',
          createdAt: new Date().toISOString(),
          metadata: {
            event: 'receipt_uploaded',
            poId: po.id,
            poNumber: po.poNumber,
            receiptId,
            totalAmount: payment.amount,
            paymentMethod: po.paymentMethod,
            receiptUrl,
          },
        })
        sendToOrg(po.buyerOrgId, 'purchaseOrder:receiptUploaded' as any, {
          poId: po.id,
          poNumber: po.poNumber,
        })

        return updatedPO
      },
    })
  },
})
