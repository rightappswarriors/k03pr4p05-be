import { arg, extendType, inputObjectType, intArg, list, nonNull, objectType, stringArg } from 'nexus'

import {
  confirmRetailerPurchaseOrderDeliveryLocation,
  createRetailerPurchaseOrder,
  getRetailerPurchaseOrder,
  getRetailerPurchaseOrderPaymentEligibility,
  getRetailerSupplierCatalog,
  listRetailerPurchaseOrders,
  quoteRetailerOrderLine,
  setRetailerPurchaseOrderPaymentMethod,
} from '../../../services/retailerOrdering.service.js'
import {
  createRetailerMayaCheckout,
  getRetailerPaymentAttempt,
  reconcileRetailerMayaPayment,
} from '../../../services/mayaPayment.service.js'
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js'
import { requireRetailerOrganization, requireSupplierOrganization } from '../../../services/supplierLink.service.js'
import { purchaseOrderCancellationRelayConfig, relayPurchaseOrderCancellation } from '../../../services/purchaseOrderCancellationRelay.service.js'
import { retailerAcceptSupplierPurchaseOrderDeliveryDate, retailerRequestDifferentPurchaseOrderDeliveryDate } from '../../../services/purchaseOrderDeliveryAgreement.service.js'

async function purchaseOrderParty(ctx: any, purchaseOrderId: string, mode: 'view' | 'supplier-edit') {
  if (!ctx.user) throw new Error('Authentication is required.')
  const po = await ctx.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { id: true, buyerOrgId: true, supplierOrgId: true } })
  if (!po) throw new Error('Purchase order not found.')
  if (ctx.user.role === 'ADMIN') return po
  if (mode === 'supplier-edit') {
    PAGE_PERMISSIONS.supplierPurchaseOrders.edit(ctx)
    const supplierOrgId = await requireSupplierOrganization(ctx)
    if (po.supplierOrgId !== supplierOrgId) throw new Error('Purchase order not found.')
    return po
  }
  if (po.buyerOrgId === ctx.user.orgId) {
    const retailerOrgId = await requireRetailerOrganization(ctx)
    if (po.buyerOrgId !== retailerOrgId) throw new Error('Purchase order not found.')
    return po
  }
  PAGE_PERMISSIONS.supplierPurchaseOrders.view(ctx)
  const supplierOrgId = await requireSupplierOrganization(ctx)
  if (po.supplierOrgId !== supplierOrgId) throw new Error('Purchase order not found.')
  return po
}

async function relayCancellation(ctx: any, purchaseOrderId: string, action: 'state' | 'request' | 'approve' | 'reject', reason?: string, actorOrgId?: number) {
  const config = purchaseOrderCancellationRelayConfig()
  return relayPurchaseOrderCancellation({
    ...config,
    purchaseOrderId,
    action,
    reason,
    actorUserId: Number(ctx.user.id ?? ctx.user.userId),
    actorOrgId,
    timeoutMs: Number(process.env.PORTAL_COMMERCE_TIMEOUT_MS ?? 10_000),
  })
}

export const RetailerCatalogPriceTier = objectType({
  name: 'RetailerCatalogPriceTier',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.int('minQty')
    t.nullable.int('maxQty')
    t.nonNull.float('price')
    t.nonNull.string('currency')
  },
})

export const RetailerCatalogVariant = objectType({
  name: 'RetailerCatalogVariant',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('name')
    t.nullable.string('sku')
    t.nonNull.float('price')
    t.nonNull.float('availableQty')
    t.nullable.string('image')
    t.nonNull.boolean('isActive')
    t.nonNull.list.nonNull.field('priceTiers', { type: 'RetailerCatalogPriceTier' })
  },
})

export const RetailerCatalogItem = objectType({
  name: 'RetailerCatalogItem',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('name')
    t.nullable.string('description')
    t.nullable.string('sku')
    t.nonNull.string('unit')
    t.nonNull.float('unitPrice')
    t.nonNull.int('moq')
    t.nonNull.int('availableQty')
    t.nullable.string('image')
    t.nonNull.list.nonNull.field('priceTiers', { type: 'RetailerCatalogPriceTier' })
    t.nonNull.list.nonNull.field('variants', { type: 'RetailerCatalogVariant' })
  },
})

export const RetailerSupplierCatalogPage = objectType({
  name: 'RetailerSupplierCatalogPage',
  definition(t) {
    t.nonNull.string('linkId')
    t.nonNull.int('supplierOrgId')
    t.nonNull.string('supplierName')
    t.nullable.string('supplierLogo')
    t.nullable.string('supplierLocation')
    t.nullable.string('supplierDescription')
    t.nonNull.int('outletId')
    t.nonNull.string('outletName')
    t.nonNull.list.nonNull.field('items', { type: 'RetailerCatalogItem' })
    t.nonNull.int('total')
    t.nonNull.int('page')
    t.nonNull.int('pageSize')
  },
})

export const RetailerOrderLineQuote = objectType({
  name: 'RetailerOrderLineQuote',
  definition(t) {
    t.nonNull.string('supplierItemId')
    t.nullable.string('supplierItemVariantId')
    t.nonNull.string('itemName')
    t.nullable.string('variantName')
    t.nullable.string('sku')
    t.nonNull.string('unit')
    t.nonNull.int('qty')
    t.nonNull.float('unitPrice')
    t.nonNull.float('subtotal')
    t.nonNull.float('vatAmount')
    t.nonNull.float('totalAmount')
    t.nonNull.string('pricingSource')
    t.nullable.int('tierMinQty')
    t.nullable.int('tierMaxQty')
  },
})

export const RetailerPurchaseOrderPage = objectType({
  name: 'RetailerPurchaseOrderPage',
  definition(t) {
    t.nonNull.list.nonNull.field('items', { type: 'PurchaseOrder' })
    t.nonNull.int('total')
    t.nonNull.int('page')
    t.nonNull.int('pageSize')
  },
})

export const MayaCheckoutResult = objectType({
  name: 'MayaCheckoutResult',
  definition(t) {
    t.nonNull.string('transactionId')
    t.nonNull.string('poId')
    t.nonNull.string('transactionStatus')
    t.nullable.string('checkoutUrl')
    t.nonNull.boolean('checkoutReusable')
    t.nullable.dateTime('checkoutExpiresAt')
    t.nonNull.float('amount')
    t.nonNull.boolean('reconciliationRequired')
    t.nonNull.boolean('canRetry')
    t.nullable.string('message')
  },
})

export const RetailerPurchaseOrderPaymentEligibility = objectType({
  name: 'RetailerPurchaseOrderPaymentEligibility',
  definition(t) {
    t.nonNull.string('poId')
    t.nonNull.float('totalAmount')
    t.nonNull.float('codMaximumAmount')
    t.nonNull.boolean('supplierAccepted')
    t.nonNull.boolean('deliveryAddressConfirmed')
    t.nonNull.boolean('deliveryDateAgreed')
    t.nonNull.string('fundingClassification')
    t.nonNull.boolean('authoritativePrepaid')
    t.nonNull.boolean('codEligible')
    t.nonNull.boolean('mayaEligible')
    t.nonNull.boolean('bankTransferSupported')
    t.nullable.string('selectedMethod')
  },
})

export const PurchaseOrderCancellationRecord = objectType({
  name: 'PurchaseOrderCancellationRecord',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('status')
    t.nonNull.string('reason')
    t.nonNull.dateTime('requestedAt')
    t.nullable.dateTime('decidedAt')
    t.nullable.dateTime('cancelledAt')
    t.nullable.int('requestedByOrgId')
    t.nullable.int('requestedByUserId')
    t.nullable.int('approvedByOrgId')
    t.nullable.int('approvedByUserId')
    t.nullable.int('rejectedByOrgId')
    t.nullable.int('rejectedByUserId')
  },
})

export const PurchaseOrderRefundRecord = objectType({
  name: 'PurchaseOrderRefundRecord',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('status')
    t.nonNull.float('amount')
    t.nonNull.string('currency')
    t.nonNull.dateTime('requestedAt')
    t.nullable.dateTime('completedAt')
    t.nullable.string('providerRefundId')
    t.nonNull.string('environment')
  },
})

export const PurchaseOrderCancellationInspection = objectType({
  name: 'PurchaseOrderCancellationInspection',
  definition(t) {
    t.nullable.string('paymentTransactionId')
    t.nullable.string('paymentProvider')
    t.nullable.string('providerReference')
    t.nullable.float('paymentAmount')
    t.nullable.float('supplierNet')
    t.nullable.float('platformFee')
    t.nullable.string('environment')
    t.nullable.string('escrowStatus')
    t.nullable.int('escrowReversalEntryId')
    t.nullable.string('settlementId')
    t.nonNull.string('platformFeeDisposition')
  },
})

export const PurchaseOrderCancellationState = objectType({
  name: 'PurchaseOrderCancellationState',
  definition(t) {
    t.nonNull.string('purchaseOrderId')
    t.nonNull.string('poNumber')
    t.nonNull.string('orderStatus')
    t.nonNull.string('paymentStatus')
    t.nullable.field('cancellation', { type: 'PurchaseOrderCancellationRecord' })
    t.nullable.field('refund', { type: 'PurchaseOrderRefundRecord' })
    t.nonNull.boolean('idempotent')
    t.nullable.field('inspection', { type: 'PurchaseOrderCancellationInspection' })
  },
})

export const RetailerPurchaseOrderLineInput = inputObjectType({
  name: 'RetailerPurchaseOrderLineInput',
  definition(t) {
    t.nonNull.string('supplierItemId')
    t.nullable.string('supplierItemVariantId')
    t.nonNull.int('qty')
  },
})

export const CreateRetailerPurchaseOrderInput = inputObjectType({
  name: 'CreateRetailerPurchaseOrderInput',
  definition(t) {
    t.nonNull.string('linkId')
    t.nonNull.string('requestId')
    t.nullable.string('notes')
    t.nullable.field('requestedDate', { type: 'DateTime' })
    t.nonNull.list.nonNull.field('lineItems', { type: 'RetailerPurchaseOrderLineInput' })
  },
})

export const ConfirmRetailerPurchaseOrderDeliveryLocationInput = inputObjectType({
  name: 'ConfirmRetailerPurchaseOrderDeliveryLocationInput',
  definition(t) {
    t.nonNull.string('purchaseOrderId')
    t.nonNull.string('address')
    t.nonNull.float('latitude')
    t.nonNull.float('longitude')
    t.nullable.string('instructions')
  },
})

export const RetailerOrderingQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.field('retailerSupplierCatalog', {
      type: 'RetailerSupplierCatalogPage',
      args: { linkId: nonNull(stringArg()), search: stringArg(), page: intArg(), pageSize: intArg() },
      resolve: (_, args, ctx) => getRetailerSupplierCatalog(ctx, args),
    })
    t.nonNull.field('retailerOrderLineQuote', {
      type: 'RetailerOrderLineQuote',
      args: {
        linkId: nonNull(stringArg()),
        supplierItemId: nonNull(stringArg()),
        supplierItemVariantId: stringArg(),
        qty: nonNull(intArg()),
      },
      resolve: (_, args, ctx) => quoteRetailerOrderLine(ctx, args),
    })
    t.nonNull.field('retailerPurchaseOrders', {
      type: 'RetailerPurchaseOrderPage',
      args: { status: arg({ type: 'POStatus' }), page: intArg(), pageSize: intArg() },
      resolve: (_, args, ctx) => listRetailerPurchaseOrders(ctx, args),
    })
    t.nonNull.field('retailerPurchaseOrder', {
      type: 'PurchaseOrder',
      args: { id: nonNull(stringArg()) },
      resolve: (_, { id }, ctx) => getRetailerPurchaseOrder(ctx, id),
    })
    t.nonNull.field('retailerPaymentAttempt', {
      type: 'MayaCheckoutResult',
      args: { transactionId: nonNull(stringArg()) },
      resolve: (_, { transactionId }, ctx) => getRetailerPaymentAttempt(ctx, transactionId),
    })
    t.nonNull.field('retailerPurchaseOrderPaymentEligibility', {
      type: 'RetailerPurchaseOrderPaymentEligibility',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: (_, { purchaseOrderId }, ctx) => getRetailerPurchaseOrderPaymentEligibility(ctx, purchaseOrderId),
    })
    t.nonNull.field('purchaseOrderCancellationState', {
      type: 'PurchaseOrderCancellationState',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: async (_, { purchaseOrderId }, ctx) => {
        await purchaseOrderParty(ctx, purchaseOrderId, 'view')
        return relayCancellation(ctx, purchaseOrderId, 'state')
      },
    })
    t.nonNull.field('adminPurchaseOrderCancellationInspection', {
      type: 'PurchaseOrderCancellationState',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: async (_, { purchaseOrderId }, ctx) => {
        if (ctx.user?.role !== 'ADMIN') throw new Error('Platform administrator access is required.')
        await purchaseOrderParty(ctx, purchaseOrderId, 'view')
        return relayCancellation(ctx, purchaseOrderId, 'state')
      },
    })
  },
})

export const RetailerOrderingMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('createRetailerPurchaseOrder', {
      type: 'PurchaseOrder',
      args: { input: nonNull(arg({ type: 'CreateRetailerPurchaseOrderInput' })) },
      resolve: (_, { input }, ctx) => createRetailerPurchaseOrder(ctx, input),
    })
    t.nonNull.field('createRetailerMayaCheckout', {
      type: 'MayaCheckoutResult',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: (_, { purchaseOrderId }, ctx) => createRetailerMayaCheckout(ctx, purchaseOrderId),
    })
    t.nonNull.field('reconcileRetailerMayaPayment', {
      type: 'MayaCheckoutResult',
      args: { transactionId: nonNull(stringArg()) },
      resolve: (_, { transactionId }, ctx) => reconcileRetailerMayaPayment(ctx, transactionId),
    })
    t.nonNull.field('confirmRetailerPurchaseOrderDeliveryLocation', {
      type: 'PurchaseOrder',
      args: { input: nonNull(arg({ type: 'ConfirmRetailerPurchaseOrderDeliveryLocationInput' })) },
      resolve: (_, { input }, ctx) => confirmRetailerPurchaseOrderDeliveryLocation(ctx, input),
    })
    t.nonNull.field('setRetailerPurchaseOrderPaymentMethod', {
      type: 'PurchaseOrder',
      args: { purchaseOrderId: nonNull(stringArg()), paymentMethod: nonNull(arg({ type: 'PaymentMethod' })) },
      resolve: (_, { purchaseOrderId, paymentMethod }, ctx) => setRetailerPurchaseOrderPaymentMethod(ctx, purchaseOrderId, paymentMethod),
    })
    t.nonNull.field('acceptSupplierPurchaseOrderDeliveryDate', {
      type: 'PurchaseOrder',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: (_, { purchaseOrderId }, ctx) => retailerAcceptSupplierPurchaseOrderDeliveryDate(ctx, purchaseOrderId),
    })
    t.nonNull.field('requestDifferentPurchaseOrderDeliveryDate', {
      type: 'PurchaseOrder',
      args: { purchaseOrderId: nonNull(stringArg()), requestedDeliveryDate: nonNull(arg({ type: 'DateTime' })) },
      resolve: (_, { purchaseOrderId, requestedDeliveryDate }, ctx) => retailerRequestDifferentPurchaseOrderDeliveryDate(ctx, purchaseOrderId, requestedDeliveryDate),
    })
    t.nonNull.field('cancelRetailerPurchaseOrder', {
      type: 'PurchaseOrderCancellationState',
      args: { purchaseOrderId: nonNull(stringArg()), reason: nonNull(stringArg()) },
      resolve: async (_, { purchaseOrderId, reason }, ctx) => {
        const retailerOrgId = await requireRetailerOrganization(ctx)
        const po = await purchaseOrderParty(ctx, purchaseOrderId, 'view')
        if (po.buyerOrgId !== retailerOrgId) throw new Error('Purchase order not found.')
        return relayCancellation(ctx, purchaseOrderId, 'request', reason, retailerOrgId)
      },
    })
    t.nonNull.field('approvePurchaseOrderCancellation', {
      type: 'PurchaseOrderCancellationState',
      args: { purchaseOrderId: nonNull(stringArg()) },
      resolve: async (_, { purchaseOrderId }, ctx) => {
        const po = await purchaseOrderParty(ctx, purchaseOrderId, 'supplier-edit')
        return relayCancellation(ctx, purchaseOrderId, 'approve', undefined, po.supplierOrgId)
      },
    })
    t.nonNull.field('rejectPurchaseOrderCancellation', {
      type: 'PurchaseOrderCancellationState',
      args: { purchaseOrderId: nonNull(stringArg()), reason: nonNull(stringArg()) },
      resolve: async (_, { purchaseOrderId, reason }, ctx) => {
        const po = await purchaseOrderParty(ctx, purchaseOrderId, 'supplier-edit')
        return relayCancellation(ctx, purchaseOrderId, 'reject', reason, po.supplierOrgId)
      },
    })
  },
})
