import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { normalizeRetailerOrderPage, requireApprovedRetailerLink, resolveRetailerLinePrice, retailerPurchaseOrderNumber } from '../src/services/retailerOrdering.service.js'
import { isRetailerPurchaseOrderPaymentEligible, normalizeMayaEvent } from '../src/services/mayaPayment.service.js'

const tier = (id: string, minQty: number, maxQty: number | null, price: number) => ({ id, minQty, maxQty, price, currency: 'PHP' })

assert.equal(resolveRetailerLinePrice({ quantity: 12, itemUnitPrice: 100, itemTiers: [tier('item', 10, null, 90)], variantPrice: 95, variantTiers: [tier('variant', 10, null, 80)] }).unitPrice, 80)
assert.equal(resolveRetailerLinePrice({ quantity: 5, itemUnitPrice: 100, itemTiers: [tier('item', 5, null, 90)], variantPrice: 95 }).unitPrice, 95)
assert.equal(resolveRetailerLinePrice({ quantity: 5, itemUnitPrice: 100, itemTiers: [tier('item', 5, null, 90)], variantPrice: 0 }).unitPrice, 90)
assert.equal(resolveRetailerLinePrice({ quantity: 1, itemUnitPrice: 100, itemTiers: [] }).unitPrice, 100)
assert.deepEqual(normalizeRetailerOrderPage(2, 50), { page: 2, pageSize: 50, skip: 50 })
assert.throws(() => normalizeRetailerOrderPage(1, 10), /20, 50, or 100/)

const keyA = retailerPurchaseOrderNumber(10, 20, 'same-request')
assert.equal(keyA, retailerPurchaseOrderNumber(10, 20, 'same-request'))
assert.notEqual(keyA, retailerPurchaseOrderNumber(10, 21, 'same-request'))
assert.notEqual(keyA, retailerPurchaseOrderNumber(11, 20, 'same-request'))

let capturedLinkScope: any
const forgedLinkContext: any = {
  user: { id: 7, orgId: 41 },
  prisma: {
    organization: { findFirst: async ({ where }: any) => where.id === 41 ? { id: 41 } : null },
    supplierOutletLink: { findFirst: async ({ where }: any) => { capturedLinkScope = where; return null } },
  },
}
await assert.rejects(() => requireApprovedRetailerLink(forgedLinkContext, 'retailer-b-link'), /Approved Supplier relationship not found/)
assert.equal(capturedLinkScope.outlet.orgId, 41)
assert.equal(capturedLinkScope.isApproved, true)

assert.equal(isRetailerPurchaseOrderPaymentEligible({ status: 'PENDING', supplierConfirmation: 'REVIEW_REQUIRED', paymentStatus: 'PENDING' }), false)
const confirmedDelivery = { address: '123 Test Street', latitude: 14.5995, longitude: 120.9842 }
assert.equal(isRetailerPurchaseOrderPaymentEligible({ status: 'SUPPLIER_ACCEPTED', supplierConfirmation: 'CONFIRMED', paymentStatus: 'PENDING', delivery: confirmedDelivery }), true)
assert.equal(isRetailerPurchaseOrderPaymentEligible({ status: 'SUPPLIER_ACCEPTED', supplierConfirmation: 'CONFIRMED', paymentStatus: 'PENDING', delivery: null }), false)
assert.equal(isRetailerPurchaseOrderPaymentEligible({ status: 'SUPPLIER_ACCEPTED', supplierConfirmation: 'CONFIRMED', paymentStatus: 'PAID', delivery: confirmedDelivery }), false)

const success = normalizeMayaEvent({ id: 'checkout-1', requestReferenceNumber: 'attempt-1', paymentStatus: 'PAYMENT_SUCCESS', isPaid: true, totalAmount: { value: 1250, currency: 'PHP' } })
assert.equal(success.status, 'SUCCEEDED')
assert.equal(success.requestReferenceNumber, 'attempt-1')
assert.equal(success.amount, 1250)
assert.equal(normalizeMayaEvent({ id: 'checkout-2', paymentStatus: 'PAYMENT_CANCELLED', totalAmount: { value: 10, currency: 'PHP' } }).status, 'CANCELLED')

const orderingSource = await readFile(new URL('../src/services/retailerOrdering.service.ts', import.meta.url), 'utf8')
assert.match(orderingSource, /outlet: \{ orgId: retailerOrgId/)
assert.match(orderingSource, /isApproved: true/)
assert.match(orderingSource, /supplierItemVariantId: line\.variant\?\.id/)
assert.match(orderingSource, /buyerOrgId: retailerOrgId/)
assert.doesNotMatch(orderingSource, /RetailOrder/)

const paymentSource = await readFile(new URL('../src/services/mayaPayment.service.ts', import.meta.url), 'utf8')
assert.match(paymentSource, /Supplier acceptance and a confirmed delivery address are required before payment/)
assert.match(paymentSource, /verifyMayaPayment/)
assert.match(paymentSource, /status: 'RECONCILIATION_REQUIRED'/)
assert.match(paymentSource, /paymentStatus: 'PAID'/)

console.log('Retailer Supplier ordering verification passed: pricing/variant identity, submit idempotency, payment gating, Maya normalization, and source-level ownership invariants.')
