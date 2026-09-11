import { extendType, nonNull, stringArg, intArg, nullable, list, arg, inputObjectType } from 'nexus'
import { PrismaClient } from '@prisma/client'
import { sendNewPONotificationEmail, sendPOStatusEmail } from '../../../services/email/kompraSupplier.email.js'
import { sendToOrg, sendToConversation } from '../../../lib/ws.js'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js'

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
  const po = await ctx.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
  if (!po || po.supplierOrgId !== supplierOrgId) throw new Error('You are not authorized to update this purchase order.')
  if (po.status === 'REJECTED' || po.status === 'CANCELLED' || po.status === 'COMPLETED') throw new Error('This purchase order can no longer be fulfilled.')
  if (po.status !== expectedStatus) throw new Error(`This order must be ${expectedStatus.replaceAll('_', ' ').toLowerCase()} before this action.`)
  if (po.supplierConfirmation !== 'CONFIRMED') throw new Error('Supplier confirmation is required before fulfillment can continue.')
  if (nextStatus === 'READY_FOR_DISPATCH' && po.deliveryDateAgreementStatus !== 'AGREED') throw new Error('Buyer and supplier must agree on the delivery date before this order can be marked ready for dispatch.')
  const payment = await ctx.prisma.paymentTransaction.findFirst({ where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, deletedAt: null }, orderBy: { updatedAt: 'desc' }, select: { status: true } })
  if (payment?.status === 'RECONCILIATION_REQUIRED') throw new Error('Payment is awaiting reconciliation and cannot enter fulfillment yet.')
  if (payment?.status !== 'SUCCEEDED') throw new Error('Payment must be confirmed before fulfillment can continue.')
  const timestamp = new Date()
  const updated = await ctx.prisma.$transaction(async (tx: any) => {
    const transitioned = await tx.purchaseOrder.updateMany({ where: { id: po.id, supplierOrgId, status: expectedStatus }, data: { status: nextStatus, ...(nextStatus === 'READY_FOR_DISPATCH' ? { readyForDispatchAt: timestamp } : {}), ...(nextStatus === 'IN_TRANSIT' ? { dispatchedAt: timestamp } : {}) } })
    if (transitioned.count !== 1) throw new Error('This order can no longer make that fulfillment transition.')
    if (nextStatus === 'IN_TRANSIT' || nextStatus === 'DELIVERED') await tx.delivery.update({ where: { poId: po.id }, data: { ...(nextStatus === 'IN_TRANSIT' ? { status: 'IN_TRANSIT' } : { status: 'DELIVERED', deliveredAt: timestamp }), ...deliveryData } })
    const result = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })
    if (result.conversationId) await tx.conversationMessage.create({ data: { conversationId: result.conversationId, senderOrgId: supplierOrgId, type: eventType, message: nextStatus.replaceAll('_', ' '), metadata: { event: eventType, poId: result.id, poNumber: result.poNumber, timestamp: timestamp.toISOString(), ...deliveryData } } })
    return result
  })
  const payload = { poId: updated.id, poNumber: updated.poNumber, status: updated.status, timestamp: timestamp.toISOString(), ...deliveryData }
  if (updated.buyerOrgId) sendToOrg(updated.buyerOrgId, realtimeEvent as any, payload)
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

  const conv = await client.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        poId: po.id,
        type: 'ORDER',
        ConversationParticipant: {
          create: [
            { agentId: po.agentId, role: 'AGENT' },
            { organizationId: po.supplierOrgId, role: 'SUPPLIER' },
          ],
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
              deliveryDateAgreementStatus: existing.requestedDate && existing.requestedDate.getTime() === expectedDeliveryDate.getTime() ? 'AGREED' : 'PENDING_BUYER',
              deliveryDateAgreedAt: existing.requestedDate && existing.requestedDate.getTime() === expectedDeliveryDate.getTime() ? new Date() : null,
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
        })

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
        const existing = await ctx.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: input.purchaseOrderId } })
        if (existing.supplierOrgId !== supplierOrgId) throw new Error('You do not have permission to accept this purchase order.')
        const repairingLegacyCommitment = existing.supplierConfirmation === 'CONFIRMED' && !existing.supplierExpectedDeliveryAt && existing.paymentStatus === 'PENDING'
        if (existing.paymentStatus === 'PAID' || (existing.supplierConfirmation !== 'REVIEW_REQUIRED' && !repairingLegacyCommitment)) throw new Error('This purchase order can no longer be reviewed.')
        const po = await ctx.prisma.$transaction(async (tx) => {
          await tx.delivery.upsert({
            where: { poId: existing.id },
            create: { poId: existing.id, scheduledDate: input.expectedDeliveryDate, status: 'SCHEDULED', driverName: input.driverName?.trim() || null, driverContact: input.driverContact?.trim() || null },
            update: { scheduledDate: input.expectedDeliveryDate, driverName: input.driverName?.trim() || null, driverContact: input.driverContact?.trim() || null },
          })
          return tx.purchaseOrder.update({
            where: { id: existing.id },
            data: { status: 'SUPPLIER_ACCEPTED', supplierConfirmation: 'CONFIRMED', supplierConfirmedAt: new Date(), supplierExpectedDeliveryAt: input.expectedDeliveryDate, deliveryDateAgreementStatus: existing.requestedDate && existing.requestedDate.getTime() === input.expectedDeliveryDate.getTime() ? 'AGREED' : 'PENDING_BUYER', deliveryDateAgreedAt: existing.requestedDate && existing.requestedDate.getTime() === input.expectedDeliveryDate.getTime() ? new Date() : null, supplierNote: input.supplierNote?.trim() || null },
          })
        })
        if (po.buyerOrgId) sendToOrg(po.buyerOrgId, 'purchaseOrder:accepted' as any, { poId: po.id, poNumber: po.poNumber })
        if (po.conversationId) sendToConversation(po.conversationId, 'conversation:newMessage' as any, { conversationId: po.conversationId, poId: po.id, poNumber: po.poNumber, type: 'PO_ACCEPTED', message: `Purchase Order ${po.poNumber} has been accepted.`, createdAt: new Date().toISOString(), metadata: { event: 'PO_ACCEPTED', poId: po.id, expectedDeliveryDate: input.expectedDeliveryDate, driverName: input.driverName?.trim() || null, driverContact: input.driverContact?.trim() || null, supplierNote: input.supplierNote?.trim() || null } })
        return po
      },
    })

    t.nonNull.field('proposePurchaseOrderDeliveryDate', {
      type: 'PurchaseOrder',
      args: {
        purchaseOrderId: nonNull(stringArg()),
        expectedDeliveryDate: nonNull(arg({ type: 'DateTime' })),
      },
      resolve: async (_, { purchaseOrderId, expectedDeliveryDate }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
        const supplierOrgId = ctx.user!.orgId
        if (!supplierOrgId) throw new Error('A supplier organization is required to update a delivery date.')
        const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId } })
        if (po.supplierOrgId !== supplierOrgId) throw new Error('You do not have permission to update this purchase order.')
        if (po.status !== 'PREPARING' || po.supplierConfirmation !== 'CONFIRMED') throw new Error('Delivery dates can only be proposed while this order is being prepared.')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        if (expectedDeliveryDate < today) throw new Error('The expected delivery date cannot be in the past.')
        const agreed = !!po.requestedDate && po.requestedDate.getTime() === expectedDeliveryDate.getTime()
        const updated = await ctx.prisma.$transaction(async (tx) => {
          await tx.delivery.upsert({
            where: { poId: po.id },
            create: { poId: po.id, scheduledDate: expectedDeliveryDate, status: 'SCHEDULED' },
            update: { scheduledDate: expectedDeliveryDate },
          })
          return tx.purchaseOrder.update({
            where: { id: po.id },
            data: {
              supplierExpectedDeliveryAt: expectedDeliveryDate,
              deliveryDateAgreementStatus: agreed ? 'AGREED' : 'PENDING_BUYER',
              deliveryDateAgreedAt: agreed ? new Date() : null,
            },
          })
        })
        const metadata = { event: 'delivery_date_proposed', poId: updated.id, poNumber: updated.poNumber, expectedDeliveryDate, deliveryDateAgreementStatus: updated.deliveryDateAgreementStatus }
        if (updated.buyerOrgId) sendToOrg(updated.buyerOrgId, 'purchaseOrder:deliveryDateProposed' as any, metadata)
        if (updated.conversationId) sendToConversation(updated.conversationId, 'conversation:newMessage' as any, { conversationId: updated.conversationId, type: 'DELIVERY_SCHEDULED', message: `Supplier proposed delivery on ${expectedDeliveryDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}.`, createdAt: new Date().toISOString(), metadata })
        return updated
      },
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
          data: { status: 'REJECTED', supplierConfirmation: 'DECLINED', rejectionReason: reason.trim() },
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
        const po = await ctx.prisma.purchaseOrder.update({ where: { id: existing.id }, data: { status: 'REJECTED', supplierConfirmation: 'DECLINED', rejectionReason: input.rejectionReason.trim() } })
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

        const po = await ctx.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
        if (!po || po.supplierOrgId !== supplierOrgId) throw new Error('You are not authorized to prepare this purchase order.')
        if (po.status === 'REJECTED') throw new Error('Rejected orders cannot be prepared.')
        if (po.status === 'CANCELLED') throw new Error('Cancelled orders cannot be prepared.')
        if (po.status === 'PREPARING') throw new Error('This order is already being prepared.')
        if (po.supplierConfirmation !== 'CONFIRMED') throw new Error('Supplier confirmation is required before the order can be prepared.')

        const payment = await ctx.prisma.paymentTransaction.findFirst({
          where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: { status: true },
        })
        if (payment?.status === 'RECONCILIATION_REQUIRED') throw new Error('Payment is awaiting reconciliation and cannot enter fulfillment yet.')
        if (payment?.status !== 'SUCCEEDED') throw new Error('Payment must be confirmed before the order can be prepared.')

        const preparedAt = new Date()
        const updated = await ctx.prisma.$transaction(async (tx) => {
          const transitioned = await tx.purchaseOrder.updateMany({
            where: { id: po.id, supplierOrgId, status: { in: ['SUPPLIER_ACCEPTED', 'ACCEPTED'] }, supplierConfirmation: 'CONFIRMED' },
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
        })

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
        PAGE_PERMISSIONS.supplierPurchaseOrders.create(ctx);
        const user = ctx.user!;

        // Verify the supplier has access to this PO
        const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({
          where: { id: input.poId, supplierOrgId: user.orgId },
          select: { conversationId: true },
        });

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
