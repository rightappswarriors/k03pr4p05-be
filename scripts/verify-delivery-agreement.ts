import 'dotenv/config'

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  classifyPurchaseOrderFunding,
  hasRequiredDeliveryDateAgreement,
  isAuthoritativeSuccessfulPrepaidTransaction,
  isPurchaseOrderPaymentReady,
} from '../src/services/purchaseOrderPolicy.service.js'

let checks = 0
const check = (condition: unknown, message: string) => {
  assert(condition, message)
  checks += 1
}
const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

const directPo = {
  id: 'po-direct-1',
  source: 'DIRECT_ORDER',
  status: 'SUPPLIER_ACCEPTED',
  supplierConfirmation: 'CONFIRMED',
  paymentStatus: 'UNPAID',
  deliveryDateAgreementStatus: 'PENDING_BUYER',
  buyerOrgId: 2,
  supplierOrgId: 1,
  totalAmount: 123_188.6,
  paymentMethod: 'CASH',
  delivery: { address: '123 Test Street', latitude: 10.3, longitude: 123.8 },
}
const validPayment = {
  id: 'payment-1',
  relatedType: 'PURCHASE_ORDER',
  relatedId: directPo.id,
  payerOrgId: 2,
  supplierOrgId: 1,
  provider: 'PAYMAYA',
  environment: 'SANDBOX',
  status: 'SUCCEEDED',
  amount: 123_188.6,
  gatewayReference: 'maya-reference-1',
  deletedAt: null,
}

check(!hasRequiredDeliveryDateAgreement(directPo), 'Direct orders must require an explicit delivery-date agreement.')
check(!isPurchaseOrderPaymentReady(directPo), 'Payment must remain unavailable while the direct-order date is unresolved.')
check(isPurchaseOrderPaymentReady({ ...directPo, deliveryDateAgreementStatus: 'AGREED' }), 'An agreed, confirmed, located direct order must become payment-ready.')
check(hasRequiredDeliveryDateAgreement({ source: 'RFQ_ORDER', deliveryDateAgreementStatus: 'PENDING_BUYER' }), 'Non-direct legacy channels must retain their existing date behavior.')
check(isAuthoritativeSuccessfulPrepaidTransaction(directPo, validPayment), 'A fully correlated Maya success must be authoritative prepaid evidence.')
check(classifyPurchaseOrderFunding(directPo, validPayment) === 'PREPAID_PAID', 'Authoritative Maya evidence must override a stale CASH label.')
check(classifyPurchaseOrderFunding({ ...directPo, totalAmount: 1_000 }, null) === 'COD_ELIGIBLE', 'Eligible true COD must retain COD funding behavior.')
check(classifyPurchaseOrderFunding(directPo, null) === 'UNFUNDED', 'An above-limit CASH label without payment evidence must remain unfunded.')
check(!isAuthoritativeSuccessfulPrepaidTransaction(directPo, { ...validPayment, amount: validPayment.amount - 0.01 }), 'Amount-mismatched payment evidence must be rejected.')
check(!isAuthoritativeSuccessfulPrepaidTransaction(directPo, { ...validPayment, gatewayReference: '' }), 'Payment evidence without a provider reference must be rejected.')

const agreementService = source('src/services/purchaseOrderDeliveryAgreement.service.ts')
const purchaseMutations = source('src/graphql/resolvers/purchaseOrder/purchaseOrder.mutation.ts')
const retailerResolver = source('src/graphql/resolvers/retailerOrdering/retailerOrdering.resolver.ts')
const orderingService = source('src/services/retailerOrdering.service.ts')
const mayaService = source('src/services/mayaPayment.service.ts')
const deliveryMutations = source('src/graphql/resolvers/delivery/delivery.mutation.ts')
const supplierDetail = source('../k03pr4p05-fe/screens/supplier/PODetailScreen.tsx')
const retailerDetail = source('../k03pr4p05-fe/screens/retailer/RetailerPurchaseOrderDetailScreen.tsx')
const deliveryDetail = source('../k03pr4p05-fe/screens/supplier/DeliveryDetailsScreen.tsx')
const webPaymentService = source('../k03pr4Web-BE/src/services/purchase-order-payment.service.ts')

check(agreementService.includes('FOR UPDATE') && agreementService.includes("isolationLevel: 'Serializable'"), 'Agreement mutations must serialize on the PO row.')
check(agreementService.includes("deliveryDateAgreementStatus: 'PENDING_BUYER'") && agreementService.includes("deliveryDateAgreementStatus: 'PENDING_SUPPLIER'"), 'Both proposal directions must be persisted explicitly.')
check(agreementService.includes("deliveryDateAgreementStatus: 'AGREED'") && agreementService.includes('deliveryDateAgreedAt: agreedAt'), 'Acceptance must persist AGREED and its timestamp atomically.')
check(agreementService.includes("if (!result.changed) return result.po"), 'Agreement retries must not republish notifications or messages.')
check(agreementService.includes('Delivery schedule requires your response') && agreementService.includes('Buyer requested a different delivery date'), 'Both parties must receive persisted proposal notifications.')
check(agreementService.includes("type: 'DELIVERY_SCHEDULED'") && agreementService.includes('conversationMessage.create'), 'Agreement changes must create one canonical PO conversation system message.')
check(retailerResolver.includes('acceptSupplierPurchaseOrderDeliveryDate') && retailerResolver.includes('requestDifferentPurchaseOrderDeliveryDate'), 'Retailer agreement actions must be server-backed GraphQL mutations.')
check(orderingService.includes('deliveryDateAgreed') && orderingService.includes('authoritativePrepaid'), 'Retailer payment eligibility must expose the server-derived agreement and funding state.')
check(mayaService.includes("po.source === 'DIRECT_ORDER' && po.deliveryDateAgreementStatus !== 'AGREED'") && mayaService.includes('Agree on the delivery schedule with the Supplier before starting payment.'), 'Portal Maya checkout must reject unresolved direct-order schedules.')
check(webPaymentService.includes("po.source === 'DIRECT_ORDER'") && webPaymentService.includes("deliveryDateAgreementStatus !== 'AGREED'"), 'The canonical Web payment entry point must enforce the same agreement gate.')
check(purchaseMutations.includes('inspectPurchaseOrderFunding') && purchaseMutations.includes('isPurchaseOrderFundingSatisfied') && purchaseMutations.includes("classification !== 'PREPAID_PAID'"), 'Supplier fulfillment must use the shared authoritative prepaid classifier.')
check(purchaseMutations.includes("deliveryDateAgreementStatus: 'AGREED'") && purchaseMutations.includes('deliveryDateNotAgreedError'), 'Prepare/dispatch mutations must enforce AGREED at the database transition boundary.')
check(deliveryMutations.includes("deliveryDateAgreementStatus !== 'AGREED'") && deliveryMutations.includes("deliveryDateAgreementStatus: 'AGREED'"), 'Delivery start must recheck agreement before IN_TRANSIT.')
check(purchaseMutations.includes("explicitLegacyReview = existing.status === 'ACCEPTED' && existing.supplierConfirmation === 'REVIEW_REQUIRED'"), 'Legacy ACCEPTED + REVIEW_REQUIRED rows must require explicit Supplier confirmation.')
check(supplierDetail.includes('Supplier confirmation required') && supplierDetail.includes('handleAcceptRetailerDeliveryDate') && supplierDetail.includes('Accept {formatDate(po.requestedDate)}'), 'Supplier detail must expose the legacy confirmation and Retailer-date acceptance states.')
check(retailerDetail.includes('Accept Delivery Date') && retailerDetail.includes('Request Different Date'), 'Retailer detail must expose both agreement decisions.')
check(retailerDetail.includes('Payment unavailable') && retailerDetail.includes('Payment received'), 'Retailer payment UX must distinguish unpaid blocking from already-paid escrow.')
check(deliveryDetail.includes('Delivery schedule awaiting') && deliveryDetail.includes("deliveryDateAgreementStatus === 'AGREED'"), 'Supplier delivery detail must surface the same agreement gate.')

if (process.argv.includes('--database')) {
  const { prisma } = await import('../src/lib/prisma.js')
  try {
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { poNumber: 'PO-20260828-8060' } })
    const [payments, delivery, cancellation, refund, settlement] = await Promise.all([
      prisma.paymentTransaction.findMany({ where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, deletedAt: null }, orderBy: { updatedAt: 'desc' } }),
      prisma.delivery.findUnique({ where: { poId: po.id } }),
      prisma.purchaseOrderCancellation.findUnique({ where: { purchaseOrderId: po.id } }),
      prisma.paymentRefund.findUnique({ where: { purchaseOrderId: po.id } }),
      prisma.purchaseOrderSettlement.findUnique({ where: { purchaseOrderId: po.id } }),
    ])
    const authoritative = payments.find((payment) => isAuthoritativeSuccessfulPrepaidTransaction(po, payment))
    check(po.status === 'ACCEPTED' && po.supplierConfirmation === 'REVIEW_REQUIRED', 'The audited legacy PO must remain explicitly unconfirmed.')
    check(po.deliveryDateAgreementStatus !== 'AGREED' && po.deliveryDateAgreedAt == null, 'The audited legacy PO must remain unresolved without inferred agreement.')
    check(Boolean(authoritative), 'The audited legacy PO must retain exact authoritative Maya success evidence.')
    check(classifyPurchaseOrderFunding(po, authoritative) === 'PREPAID_PAID', 'The audited stale CASH PO must classify as prepaid from immutable Maya evidence.')
    check(po.paymentStatus === 'PAID', 'The audited legacy payment must remain paid while agreement is unresolved.')
    check(cancellation == null && refund == null, 'The audited legacy PO must have no cancellation/refund blocker.')
    check(settlement == null, 'The uncompleted audited PO must not have an early settlement.')
    check(Boolean(delivery?.address?.trim()) && Number.isFinite(delivery?.latitude) && Number.isFinite(delivery?.longitude), 'The audited PO must retain its confirmed delivery location.')
  } finally {
    await prisma.$disconnect()
  }
}

console.info(`PASS: ${checks} delivery-agreement, payment-gate, funding, fulfillment, UI, and retry checks.`)
