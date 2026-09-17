export const DEFAULT_COD_MAX_ORDER_AMOUNT_PHP = 25_000;
export function codMaxOrderAmountPhp() {
    const configured = Number(process.env.COD_MAX_ORDER_AMOUNT_PHP ?? DEFAULT_COD_MAX_ORDER_AMOUNT_PHP);
    return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_COD_MAX_ORDER_AMOUNT_PHP;
}
export function toCentavos(amount) {
    if (!Number.isFinite(amount))
        throw new Error('A valid Purchase Order total is required.');
    return Math.round(amount * 100);
}
export function isCodAmountEligible(totalAmount, maximum = codMaxOrderAmountPhp()) {
    return toCentavos(totalAmount) <= toCentavos(maximum);
}
export function hasConfirmedDeliveryLocation(delivery) {
    return Boolean(delivery?.address?.trim()
        && Number.isFinite(delivery.latitude)
        && Number.isFinite(delivery.longitude));
}
export function isSupplierAcceptedPurchaseOrder(po) {
    return po.supplierConfirmation === 'CONFIRMED' && ['SUPPLIER_ACCEPTED', 'ACCEPTED'].includes(po.status);
}
export function requiresDeliveryDateAgreement(po) {
    return po.source === 'DIRECT_ORDER';
}
export function hasRequiredDeliveryDateAgreement(po) {
    return !requiresDeliveryDateAgreement(po) || po.deliveryDateAgreementStatus === 'AGREED';
}
export function isPurchaseOrderPaymentReady(po) {
    return po.paymentStatus !== 'PAID'
        && isSupplierAcceptedPurchaseOrder(po)
        && hasConfirmedDeliveryLocation(po.delivery)
        && hasRequiredDeliveryDateAgreement(po);
}
export function isAuthoritativeSuccessfulPrepaidTransaction(po, payment) {
    return Boolean(payment
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
        && toCentavos(payment.amount) === toCentavos(po.totalAmount));
}
export function classifyPurchaseOrderFunding(po, payment) {
    if (isAuthoritativeSuccessfulPrepaidTransaction(po, payment))
        return 'PREPAID_PAID';
    if (po.paymentMethod === 'CASH' && isCodAmountEligible(po.totalAmount))
        return 'COD_ELIGIBLE';
    return 'UNFUNDED';
}
export function isPurchaseOrderFundingSatisfied(po, payment) {
    return classifyPurchaseOrderFunding(po, payment) !== 'UNFUNDED';
}
export async function inspectPurchaseOrderFunding(client, po) {
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
    });
    const authoritativePayment = attempts.find((attempt) => isAuthoritativeSuccessfulPrepaidTransaction(po, attempt)) ?? null;
    return {
        classification: classifyPurchaseOrderFunding(po, authoritativePayment),
        authoritativePayment,
        latestPayment: attempts[0] ?? null,
    };
}
