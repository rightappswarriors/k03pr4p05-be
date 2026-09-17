import { GraphQLError } from 'graphql'

import type { Context } from '../lib/types.js'
import { PAGE_PERMISSIONS } from '../lib/permissions.map.js'
import { sendToConversation, sendToOrg } from '../lib/ws.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { publishBusinessNotification } from './notification.service.js'
import { requireRetailerOrganization } from './supplierLink.service.js'

const NEGOTIABLE_STATUSES = ['SUPPLIER_ACCEPTED', 'ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH']
const AUTO_AGREEMENT_STATUSES = ['SUPPLIER_ACCEPTED', 'ACCEPTED']
export const DEFAULT_DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS = 24

export function getDeliveryAgreementBuyerResponseHours() {
  const configured = Number(process.env.DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DELIVERY_AGREEMENT_BUYER_RESPONSE_HOURS
}

export function getDeliveryAgreementDeadline(proposedAt = new Date(), responseHours = getDeliveryAgreementBuyerResponseHours()) {
  return new Date(proposedAt.getTime() + responseHours * 60 * 60 * 1000)
}

export function isDeliveryAgreementDeadlineExpired(deadline: Date | string | null | undefined, now = new Date()) {
  if (!deadline) return false
  const parsed = deadline instanceof Date ? deadline : new Date(deadline)
  return Number.isFinite(parsed.getTime()) && parsed.getTime() <= now.getTime()
}

export function nextSupplierProposalDeadline(po: { source?: string | null; status?: string | null; buyerOrgId?: number | null; supplierOrgId: number; deliveryDateProposalVersion?: number | null }, proposedAt = new Date()) {
  const validBuyerIdentity = po.buyerOrgId != null && po.buyerOrgId !== po.supplierOrgId
  const eligibleState = po.status != null && AUTO_AGREEMENT_STATUSES.includes(po.status)
  return {
    deliveryDateResponseDeadlineAt: po.source === 'DIRECT_ORDER' && validBuyerIdentity && eligibleState ? getDeliveryAgreementDeadline(proposedAt) : null,
    deliveryDateProposalVersion: (po.deliveryDateProposalVersion ?? 0) + 1,
  }
}

export function deliveryDateNotAgreedError(action = 'prepared') {
  return new GraphQLError(`The delivery schedule must be accepted by both parties before the order can be ${action}.`, {
    extensions: { code: 'DELIVERY_DATE_NOT_AGREED' },
  })
}

function assertDeliveryDate(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (Number.isNaN(date.getTime()) || date < today) throw new Error('The delivery date cannot be in the past.')
}

function formatDeliveryDate(date: Date) {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
}

function formatDeliveryDeadline(date: Date) {
  return date.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
}

function assertNegotiablePurchaseOrder(po: any) {
  if (po.source !== 'DIRECT_ORDER') throw new Error('Delivery-date negotiation is available only for direct Supplier orders.')
  if (po.supplierConfirmation !== 'CONFIRMED') throw new Error('Supplier confirmation is required before negotiating the delivery date.')
  if (!NEGOTIABLE_STATUSES.includes(po.status)) throw new Error('The delivery schedule can no longer be changed at this fulfillment stage.')
}

async function assertNoAgreementBlocker(tx: any, purchaseOrderId: string) {
  const [cancellation, refund] = await Promise.all([
    tx.purchaseOrderCancellation.findUnique({ where: { purchaseOrderId }, select: { status: true } }),
    tx.paymentRefund.findUnique({ where: { purchaseOrderId }, select: { status: true } }),
  ])
  if (cancellation?.status === 'REQUESTED') throw new Error('Resolve the pending cancellation request before changing the delivery schedule.')
  if (refund) throw new Error('The delivery schedule cannot be changed while this order has a refund record.')
}

async function createAgreementNotification(tx: any, input: { orgId: number; outletId?: number | null; conversationId?: string | null; title: string; message: string; referenceType?: string | null; referenceId?: string | null }) {
  return tx.notification.create({
    data: {
      orgId: input.orgId,
      outletId: input.outletId ?? null,
      conversationId: input.conversationId ?? null,
      type: 'NEW_TRANSACTION',
      title: input.title,
      message: input.message,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
    },
  })
}

function publishAgreementResult(result: any, event: string) {
  if (!result.changed) return result.po
  publishBusinessNotification(result.notification)
  const payload = {
    poId: result.po.id,
    poNumber: result.po.poNumber,
    deliveryDateAgreementStatus: result.po.deliveryDateAgreementStatus,
    requestedDate: result.po.requestedDate?.toISOString?.() ?? result.po.requestedDate ?? null,
    supplierExpectedDeliveryAt: result.po.supplierExpectedDeliveryAt?.toISOString?.() ?? result.po.supplierExpectedDeliveryAt ?? null,
    deliveryDateResponseDeadlineAt: result.po.deliveryDateResponseDeadlineAt?.toISOString?.() ?? result.po.deliveryDateResponseDeadlineAt ?? null,
    deliveryDateAgreementMethod: result.po.deliveryDateAgreementMethod ?? null,
  }
  sendToOrg(result.notifyOrgId, event as any, payload)
  sendToOrg(result.actorOrgId, event as any, payload)
  if (result.po.conversationId && result.message) {
    sendToConversation(result.po.conversationId, 'conversation:newMessage' as any, {
      ...result.message,
      createdAt: result.message.createdAt.toISOString(),
    })
  }
  return result.po
}

export async function supplierProposePurchaseOrderDeliveryDate(ctx: Context, purchaseOrderId: string, expectedDeliveryDate: Date) {
  requireAuth(ctx)
  PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
  const supplierOrgId = ctx.user!.orgId
  if (!supplierOrgId) throw new Error('A Supplier organization is required to update a delivery date.')
  assertDeliveryDate(expectedDeliveryDate)

  const result = await ctx.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} FOR UPDATE`
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
    if (!po || po.supplierOrgId !== supplierOrgId) throw new Error('Purchase order not found.')
    assertNegotiablePurchaseOrder(po)
    await assertNoAgreementBlocker(tx, po.id)

    if (po.deliveryDateAgreementStatus === 'PENDING_BUYER' && po.deliveryDateResponseDeadlineAt && po.supplierExpectedDeliveryAt?.getTime() === expectedDeliveryDate.getTime()) {
      return { po, changed: false, notification: null, message: null, actorOrgId: supplierOrgId, notifyOrgId: po.buyerOrgId }
    }

    const proposedAt = new Date()
    const proposalDeadline = nextSupplierProposalDeadline(po, proposedAt)
    const updated = await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        supplierExpectedDeliveryAt: expectedDeliveryDate,
        deliveryDateAgreementStatus: 'PENDING_BUYER',
        deliveryDateAgreedAt: null,
        deliveryDateAgreementMethod: null,
        ...proposalDeadline,
      },
    })
    await tx.delivery.upsert({
      where: { poId: po.id },
      create: { poId: po.id, scheduledDate: expectedDeliveryDate, status: 'SCHEDULED' },
      update: { scheduledDate: expectedDeliveryDate },
    })
    const displayDate = formatDeliveryDate(expectedDeliveryDate)
    const message = updated.conversationId ? await tx.conversationMessage.create({
      data: {
        conversationId: updated.conversationId,
        senderOrgId: supplierOrgId,
        type: 'DELIVERY_SCHEDULED',
        message: `Supplier proposed delivery for ${displayDate}.`,
        metadata: { event: 'SUPPLIER_DELIVERY_DATE_PROPOSED', poId: updated.id, expectedDeliveryDate: expectedDeliveryDate.toISOString(), proposalVersion: updated.deliveryDateProposalVersion, responseDeadlineAt: updated.deliveryDateResponseDeadlineAt?.toISOString() ?? null },
      },
    }) : null
    const notification = updated.buyerOrgId ? await createAgreementNotification(tx, {
      orgId: updated.buyerOrgId,
      outletId: updated.deliveryOutletId,
      conversationId: updated.conversationId,
      referenceType: 'PURCHASE_ORDER',
      referenceId: updated.id,
      title: 'Delivery schedule requires your response',
      message: updated.deliveryDateResponseDeadlineAt
        ? `The Supplier proposed ${displayDate} for Purchase Order ${updated.poNumber}. Respond by ${formatDeliveryDeadline(updated.deliveryDateResponseDeadlineAt)}.`
        : `The Supplier proposed ${displayDate} for Purchase Order ${updated.poNumber}. Account review is required before timeout processing.`,
    }) : null
    return { po: updated, changed: true, notification, message, actorOrgId: supplierOrgId, notifyOrgId: updated.buyerOrgId }
  }, { isolationLevel: 'Serializable' })

  const po = publishAgreementResult(result, 'purchaseOrder:deliveryDateProposed')
  if (result.changed && po.deliveryDateResponseDeadlineAt) {
    void enqueueDeliveryAgreementTimeout({ purchaseOrderId: po.id, proposalVersion: po.deliveryDateProposalVersion, deadline: po.deliveryDateResponseDeadlineAt, supplierProposal: po.supplierExpectedDeliveryAt }).catch((error) => {
      if (process.env.NODE_ENV === 'development') console.warn('[Delivery agreement] delayed job unavailable; recovery scan remains active.', error)
    })
  }
  return po
}

export async function supplierAcceptRetailerPurchaseOrderDeliveryDate(ctx: Context, purchaseOrderId: string) {
  requireAuth(ctx)
  PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
  const supplierOrgId = ctx.user!.orgId
  if (!supplierOrgId) throw new Error('A Supplier organization is required to accept a delivery date.')

  const result = await ctx.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} FOR UPDATE`
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
    if (!po || po.supplierOrgId !== supplierOrgId) throw new Error('Purchase order not found.')
    assertNegotiablePurchaseOrder(po)
    await assertNoAgreementBlocker(tx, po.id)
    if (po.deliveryDateAgreementStatus === 'AGREED' && po.requestedDate) {
      return { po, changed: false, notification: null, message: null, actorOrgId: supplierOrgId, notifyOrgId: po.buyerOrgId }
    }
    if (po.deliveryDateAgreementStatus !== 'PENDING_SUPPLIER' || !po.requestedDate) throw new Error('There is no Retailer delivery-date proposal awaiting Supplier acceptance.')

    const agreedAt = new Date()
    const updated = await tx.purchaseOrder.updateMany({
      where: { id: po.id, supplierOrgId, deliveryDateAgreementStatus: 'PENDING_SUPPLIER', requestedDate: po.requestedDate },
      data: { supplierExpectedDeliveryAt: po.requestedDate, deliveryDateAgreementStatus: 'AGREED', deliveryDateAgreedAt: agreedAt, deliveryDateAgreementMethod: 'SUPPLIER_ACCEPTED', deliveryDateResponseDeadlineAt: null },
    })
    if (updated.count !== 1) throw new Error('The delivery-date proposal changed before it could be accepted. Refresh and try again.')
    await tx.delivery.upsert({
      where: { poId: po.id },
      create: { poId: po.id, scheduledDate: po.requestedDate, status: 'SCHEDULED' },
      update: { scheduledDate: po.requestedDate },
    })
    const current = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })
    const displayDate = formatDeliveryDate(po.requestedDate)
    const message = current.conversationId ? await tx.conversationMessage.create({
      data: { conversationId: current.conversationId, senderOrgId: supplierOrgId, type: 'DELIVERY_SCHEDULED', message: `Supplier accepted the delivery schedule for ${displayDate}.`, metadata: { event: 'SUPPLIER_DELIVERY_DATE_ACCEPTED', poId: current.id, agreedAt: agreedAt.toISOString() } },
    }) : null
    const notification = current.buyerOrgId ? await createAgreementNotification(tx, { orgId: current.buyerOrgId, outletId: current.deliveryOutletId, conversationId: current.conversationId, title: 'Delivery schedule agreed', message: `The Supplier accepted ${displayDate} for Purchase Order ${current.poNumber}.`, referenceType: 'PURCHASE_ORDER', referenceId: current.id }) : null
    return { po: current, changed: true, notification, message, actorOrgId: supplierOrgId, notifyOrgId: current.buyerOrgId }
  }, { isolationLevel: 'Serializable' })

  return publishAgreementResult(result, 'purchaseOrder:deliveryDateAgreed')
}

export async function retailerAcceptSupplierPurchaseOrderDeliveryDate(ctx: Context, purchaseOrderId: string) {
  const retailerOrgId = await requireRetailerOrganization(ctx)
  const result = await ctx.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} FOR UPDATE`
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
    if (!po || po.buyerOrgId !== retailerOrgId) throw new Error('Purchase order not found.')
    assertNegotiablePurchaseOrder(po)
    await assertNoAgreementBlocker(tx, po.id)
    if (po.deliveryDateAgreementStatus === 'AGREED' && po.supplierExpectedDeliveryAt) {
      return { po, changed: false, notification: null, message: null, actorOrgId: retailerOrgId, notifyOrgId: po.supplierOrgId }
    }
    if (po.deliveryDateAgreementStatus !== 'PENDING_BUYER' || !po.supplierExpectedDeliveryAt) throw new Error('There is no Supplier delivery-date proposal awaiting Retailer acceptance.')

    const agreedAt = new Date()
    const updated = await tx.purchaseOrder.updateMany({
      where: { id: po.id, buyerOrgId: retailerOrgId, deliveryDateAgreementStatus: 'PENDING_BUYER', supplierExpectedDeliveryAt: po.supplierExpectedDeliveryAt },
      data: { requestedDate: po.supplierExpectedDeliveryAt, deliveryDateAgreementStatus: 'AGREED', deliveryDateAgreedAt: agreedAt, deliveryDateAgreementMethod: 'BUYER_ACCEPTED', deliveryDateResponseDeadlineAt: null },
    })
    if (updated.count !== 1) throw new Error('The delivery-date proposal changed before it could be accepted. Refresh and try again.')
    const current = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })
    const displayDate = formatDeliveryDate(po.supplierExpectedDeliveryAt)
    const message = current.conversationId ? await tx.conversationMessage.create({
      data: { conversationId: current.conversationId, senderOrgId: retailerOrgId, type: 'DELIVERY_SCHEDULED', message: `Buyer accepted the delivery schedule for ${displayDate}.`, metadata: { event: 'BUYER_DELIVERY_DATE_ACCEPTED', poId: current.id, agreedAt: agreedAt.toISOString() } },
    }) : null
    const notification = await createAgreementNotification(tx, { orgId: current.supplierOrgId, outletId: current.deliveryOutletId, conversationId: current.conversationId, title: 'Delivery schedule agreed', message: `The Buyer accepted ${displayDate} for Purchase Order ${current.poNumber}.`, referenceType: 'PURCHASE_ORDER', referenceId: current.id })
    return { po: current, changed: true, notification, message, actorOrgId: retailerOrgId, notifyOrgId: current.supplierOrgId }
  }, { isolationLevel: 'Serializable' })

  return publishAgreementResult(result, 'purchaseOrder:deliveryDateAgreed')
}

export async function retailerRequestDifferentPurchaseOrderDeliveryDate(ctx: Context, purchaseOrderId: string, requestedDeliveryDate: Date) {
  const retailerOrgId = await requireRetailerOrganization(ctx)
  assertDeliveryDate(requestedDeliveryDate)
  const result = await ctx.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} FOR UPDATE`
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
    if (!po || po.buyerOrgId !== retailerOrgId) throw new Error('Purchase order not found.')
    assertNegotiablePurchaseOrder(po)
    await assertNoAgreementBlocker(tx, po.id)
    if (po.deliveryDateAgreementStatus === 'PENDING_SUPPLIER' && po.requestedDate?.getTime() === requestedDeliveryDate.getTime()) {
      return { po, changed: false, notification: null, message: null, actorOrgId: retailerOrgId, notifyOrgId: po.supplierOrgId }
    }

    const updated = await tx.purchaseOrder.update({ where: { id: po.id }, data: { requestedDate: requestedDeliveryDate, deliveryDateAgreementStatus: 'PENDING_SUPPLIER', deliveryDateAgreedAt: null, deliveryDateAgreementMethod: null, deliveryDateResponseDeadlineAt: null } })
    const displayDate = formatDeliveryDate(requestedDeliveryDate)
    const message = updated.conversationId ? await tx.conversationMessage.create({
      data: { conversationId: updated.conversationId, senderOrgId: retailerOrgId, type: 'DELIVERY_SCHEDULED', message: `Buyer requested delivery on ${displayDate}.`, metadata: { event: 'BUYER_DELIVERY_DATE_PROPOSED', poId: updated.id, requestedDeliveryDate: requestedDeliveryDate.toISOString() } },
    }) : null
    const notification = await createAgreementNotification(tx, { orgId: updated.supplierOrgId, outletId: updated.deliveryOutletId, conversationId: updated.conversationId, title: 'Buyer requested a different delivery date', message: `The Buyer requested ${displayDate} for Purchase Order ${updated.poNumber}.`, referenceType: 'PURCHASE_ORDER', referenceId: updated.id })
    return { po: updated, changed: true, notification, message, actorOrgId: retailerOrgId, notifyOrgId: updated.supplierOrgId }
  }, { isolationLevel: 'Serializable' })

  return publishAgreementResult(result, 'purchaseOrder:deliveryDateProposed')
}

type DeliveryAgreementTimeoutIdentity = {
  purchaseOrderId: string
  proposalVersion?: number
  deadline?: Date | string
  supplierProposal?: Date | string
}

type TimeoutPurchaseOrderState = {
  id: string
  source: string
  status: string
  buyerOrgId?: number | null
  supplierOrgId: number
  deliveryDateAgreementStatus: string
  deliveryDateResponseDeadlineAt?: Date | string | null
  deliveryDateProposalVersion?: number | null
  supplierExpectedDeliveryAt?: Date | string | null
}

export function evaluateDeliveryAgreementTimeout(
  po: TimeoutPurchaseOrderState,
  identity: DeliveryAgreementTimeoutIdentity,
  now = new Date(),
  blockers: { cancellationStatus?: string | null; refundExists?: boolean } = {},
) {
  if (po.source !== 'DIRECT_ORDER' || po.deliveryDateAgreementStatus !== 'PENDING_BUYER') return { eligible: false, reason: 'INACTIVE' as const }
  if (!po.deliveryDateResponseDeadlineAt || !po.supplierExpectedDeliveryAt || !isDeliveryAgreementDeadlineExpired(po.deliveryDateResponseDeadlineAt, now)) return { eligible: false, reason: 'NOT_EXPIRED' as const }
  if (!AUTO_AGREEMENT_STATUSES.includes(po.status) || po.buyerOrgId == null || po.buyerOrgId === po.supplierOrgId) return { eligible: false, reason: 'INELIGIBLE_IDENTITY_OR_STATE' as const }
  if (identity.proposalVersion != null && po.deliveryDateProposalVersion !== identity.proposalVersion) return { eligible: false, reason: 'STALE_PROPOSAL_VERSION' as const }
  if (identity.deadline && new Date(po.deliveryDateResponseDeadlineAt).getTime() !== new Date(identity.deadline).getTime()) return { eligible: false, reason: 'STALE_DEADLINE' as const }
  if (identity.supplierProposal && new Date(po.supplierExpectedDeliveryAt).getTime() !== new Date(identity.supplierProposal).getTime()) return { eligible: false, reason: 'STALE_PROPOSAL_DATE' as const }
  if (blockers.cancellationStatus === 'REQUESTED' || blockers.refundExists) return { eligible: false, reason: 'BLOCKED' as const }
  return { eligible: true, reason: 'ELIGIBLE' as const }
}

export async function enqueueDeliveryAgreementTimeout(identity: Required<DeliveryAgreementTimeoutIdentity>) {
  const { deliveryAgreementQueue } = await import('../queue/deliveryAgreement.queue.js')
  const deadline = new Date(identity.deadline)
  await deliveryAgreementQueue.add('auto-agree-buyer-timeout', {
    purchaseOrderId: identity.purchaseOrderId,
    proposalVersion: identity.proposalVersion,
    deadline: deadline.toISOString(),
    supplierProposal: new Date(identity.supplierProposal).toISOString(),
  }, {
    jobId: `delivery-agreement-${identity.purchaseOrderId}-${identity.proposalVersion}`,
    delay: Math.max(0, deadline.getTime() - Date.now()),
  })
}

function publishAutomaticAgreement(result: any) {
  if (!result.changed) return result
  for (const notification of result.notifications) publishBusinessNotification(notification)
  const payload = {
    poId: result.po.id,
    poNumber: result.po.poNumber,
    deliveryDateAgreementStatus: result.po.deliveryDateAgreementStatus,
    deliveryDateAgreementMethod: result.po.deliveryDateAgreementMethod,
    supplierExpectedDeliveryAt: result.po.supplierExpectedDeliveryAt?.toISOString?.() ?? result.po.supplierExpectedDeliveryAt,
  }
  sendToOrg(result.po.buyerOrgId, 'purchaseOrder:deliveryDateAgreed' as any, payload)
  sendToOrg(result.po.supplierOrgId, 'purchaseOrder:deliveryDateAgreed' as any, payload)
  if (result.po.conversationId && result.message) {
    sendToConversation(result.po.conversationId, 'conversation:newMessage' as any, { ...result.message, createdAt: result.message.createdAt.toISOString() })
  }
  return result
}

export async function reconcileExpiredDeliveryAgreement(prisma: any, identity: DeliveryAgreementTimeoutIdentity, now = new Date()) {
  const result = await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${identity.purchaseOrderId} FOR UPDATE`
    const po = await tx.purchaseOrder.findUnique({ where: { id: identity.purchaseOrderId } })
    if (!po) return { changed: false, reason: 'INACTIVE' }
    const initialDecision = evaluateDeliveryAgreementTimeout(po, identity, now)
    if (!initialDecision.eligible) return { changed: false, reason: initialDecision.reason }

    const [cancellation, refund] = await Promise.all([
      tx.purchaseOrderCancellation.findUnique({ where: { purchaseOrderId: po.id }, select: { status: true } }),
      tx.paymentRefund.findUnique({ where: { purchaseOrderId: po.id }, select: { id: true } }),
    ])
    const finalDecision = evaluateDeliveryAgreementTimeout(po, identity, now, { cancellationStatus: cancellation?.status, refundExists: Boolean(refund) })
    if (!finalDecision.eligible) return { changed: false, reason: finalDecision.reason }
    const supplierProposal = po.supplierExpectedDeliveryAt!
    const responseDeadline = po.deliveryDateResponseDeadlineAt!

    const transitioned = await tx.purchaseOrder.updateMany({
      where: {
        id: po.id,
        status: { in: AUTO_AGREEMENT_STATUSES as any },
        deliveryDateAgreementStatus: 'PENDING_BUYER',
        deliveryDateProposalVersion: po.deliveryDateProposalVersion,
        deliveryDateResponseDeadlineAt: responseDeadline,
        supplierExpectedDeliveryAt: supplierProposal,
      },
      data: {
        requestedDate: supplierProposal,
        deliveryDateAgreementStatus: 'AGREED',
        deliveryDateAgreedAt: now,
        deliveryDateAgreementMethod: 'AUTO_BUYER_TIMEOUT',
        deliveryDateResponseDeadlineAt: null,
      },
    })
    if (transitioned.count !== 1) return { changed: false, reason: 'RACE_LOST' }

    await tx.delivery.upsert({
      where: { poId: po.id },
      create: { poId: po.id, scheduledDate: supplierProposal, status: 'SCHEDULED' },
      update: { scheduledDate: supplierProposal },
    })
    const current = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })
    const displayDate = formatDeliveryDate(supplierProposal)
    const message = current.conversationId ? await tx.conversationMessage.create({
      data: {
        conversationId: current.conversationId,
        type: 'DELIVERY_SCHEDULED',
        message: `Delivery schedule for ${displayDate} was automatically accepted after the Buyer response period expired.`,
        metadata: { event: 'DELIVERY_DATE_AUTO_AGREED', poId: current.id, proposalVersion: current.deliveryDateProposalVersion, agreedAt: now.toISOString(), agreementMethod: 'AUTO_BUYER_TIMEOUT' },
      },
    }) : null
    const notifications = await Promise.all([
      createAgreementNotification(tx, { orgId: current.buyerOrgId!, outletId: current.deliveryOutletId, conversationId: current.conversationId, title: 'Delivery schedule automatically accepted', message: `${displayDate} was automatically accepted for Purchase Order ${current.poNumber} after the response period expired.`, referenceType: 'PURCHASE_ORDER', referenceId: current.id }),
      createAgreementNotification(tx, { orgId: current.supplierOrgId, outletId: current.deliveryOutletId, conversationId: current.conversationId, title: 'Buyer response period expired', message: `Your ${displayDate} delivery proposal for Purchase Order ${current.poNumber} was automatically accepted.`, referenceType: 'PURCHASE_ORDER', referenceId: current.id }),
    ])
    return { changed: true, po: current, notifications, message }
  }, { isolationLevel: 'Serializable' })

  return publishAutomaticAgreement(result)
}

export async function reconcileExpiredDeliveryAgreements(prisma: any, limit = 50, now = new Date()) {
  const candidates = await prisma.purchaseOrder.findMany({
    where: {
      source: 'DIRECT_ORDER',
      status: { in: AUTO_AGREEMENT_STATUSES as any },
      deliveryDateAgreementStatus: 'PENDING_BUYER',
      deliveryDateResponseDeadlineAt: { lte: now },
    },
    orderBy: { deliveryDateResponseDeadlineAt: 'asc' },
    take: Math.min(100, Math.max(1, limit)),
    select: { id: true },
  })
  let changed = 0
  for (const candidate of candidates) {
    const result = await reconcileExpiredDeliveryAgreement(prisma, { purchaseOrderId: candidate.id }, now)
    if (result.changed) changed += 1
  }
  return { scanned: candidates.length, changed }
}
