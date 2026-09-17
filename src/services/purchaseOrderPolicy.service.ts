export const DEFAULT_COD_MAX_ORDER_AMOUNT_PHP = 25_000

export function codMaxOrderAmountPhp() {
  const configured = Number(process.env.COD_MAX_ORDER_AMOUNT_PHP ?? DEFAULT_COD_MAX_ORDER_AMOUNT_PHP)
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_COD_MAX_ORDER_AMOUNT_PHP
}

export function toCentavos(amount: number) {
  if (!Number.isFinite(amount)) throw new Error('A valid Purchase Order total is required.')
  return Math.round(amount * 100)
}

export function isCodAmountEligible(totalAmount: number, maximum = codMaxOrderAmountPhp()) {
  return toCentavos(totalAmount) <= toCentavos(maximum)
}

export function hasConfirmedDeliveryLocation(delivery?: { address?: string | null; latitude?: number | null; longitude?: number | null } | null) {
  return Boolean(
    delivery?.address?.trim()
    && Number.isFinite(delivery.latitude)
    && Number.isFinite(delivery.longitude),
  )
}

export function isSupplierAcceptedPurchaseOrder(po: { status: string; supplierConfirmation: string }) {
  return po.supplierConfirmation === 'CONFIRMED' && ['SUPPLIER_ACCEPTED', 'ACCEPTED'].includes(po.status)
}

export function requiresDeliveryDateAgreement(po: { source?: string | null }) {
  return po.source === 'DIRECT_ORDER'
}

export function hasRequiredDeliveryDateAgreement(po: { source?: string | null; deliveryDateAgreementStatus?: string | null }) {
  return !requiresDeliveryDateAgreement(po) || po.deliveryDateAgreementStatus === 'AGREED'
}

export function isPurchaseOrderPaymentReady(po: { source?: string | null; status: string; supplierConfirmation: string; paymentStatus: string; deliveryDateAgreementStatus?: string | null; delivery?: { address?: string | null; latitude?: number | null; longitude?: number | null } | null }) {
  return po.paymentStatus !== 'PAID'
    && isSupplierAcceptedPurchaseOrder(po)
    && hasConfirmedDeliveryLocation(po.delivery)
    && hasRequiredDeliveryDateAgreement(po)
}

type FundingPurchaseOrder = {
  id: string
  buyerOrgId?: number | null
  supplierOrgId: number
  totalAmount: number
  paymentMethod?: string | null
}

type FundingPaymentTransaction = {
  id: string
  relatedType: string
  relatedId: string
  payerOrgId?: number | null
  supplierOrgId?: number | null
  provider: string
  environment: string
  status: string
  amount: number
  gatewayReference?: string | null
  deletedAt?: Date | null
}

export type PurchaseOrderFundingClassification = 'PREPAID_PAID' | 'COD_ELIGIBLE' | 'UNFUNDED'

export function isAuthoritativeSuccessfulPrepaidTransaction(po: FundingPurchaseOrder, payment?: FundingPaymentTransaction | null) {
  return Boolean(
    payment
    && payment.deletedAt == null
    && payment.relatedType === 'PURCHASE_ORDER'
    && payment.relatedId === po.id
    && payment.status === 'SUCCEEDED'
    && payment.provider === 'PAYMAYA'
    && ['SANDBOX', 'PRODUCTION'].includes(payment.environment)
    && payment.supplierOrgId === po.supplierOrgId
    && (po.buyerOrgId == null || payment.payerOrgId === po.buyerOrgId)
    && typeof payment.gatewayReference === 'string'
    && payment.gatewayReference.trim().length > 0
    && toCentavos(payment.amount) === toCentavos(po.totalAmount),
  )
}

export function classifyPurchaseOrderFunding(po: FundingPurchaseOrder, payment?: FundingPaymentTransaction | null): PurchaseOrderFundingClassification {
  if (isAuthoritativeSuccessfulPrepaidTransaction(po, payment)) return 'PREPAID_PAID'
  if (po.paymentMethod === 'CASH' && isCodAmountEligible(po.totalAmount)) return 'COD_ELIGIBLE'
  return 'UNFUNDED'
}

export function isPurchaseOrderFundingSatisfied(po: FundingPurchaseOrder, payment?: FundingPaymentTransaction | null) {
  return classifyPurchaseOrderFunding(po, payment) !== 'UNFUNDED'
}

export async function inspectPurchaseOrderFunding(client: any, po: FundingPurchaseOrder) {
  const attempts = await client.paymentTransaction.findMany({
    where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      relatedType: true,
      relatedId: true,
      payerOrgId: true,
      supplierOrgId: true,
      provider: true,
      environment: true,
      status: true,
      amount: true,
      gatewayReference: true,
      deletedAt: true,
    },
  })
  const authoritativePayment = attempts.find((attempt: FundingPaymentTransaction) => isAuthoritativeSuccessfulPrepaidTransaction(po, attempt)) ?? null
  return {
    classification: classifyPurchaseOrderFunding(po, authoritativePayment),
    authoritativePayment,
    latestPayment: attempts[0] ?? null,
  }
}
