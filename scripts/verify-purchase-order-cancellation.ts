import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cancellationRequiresRefund, purchaseOrderCancellationMode } from '../../k03pr4Web-BE/src/services/purchase-order-cancellation.policy.js'

const root = resolve(process.cwd(), '..')
const webService = readFileSync(resolve(root, 'k03pr4Web-BE/src/services/purchase-order-cancellation.service.ts'), 'utf8')
const paymentConfirmation = readFileSync(resolve(root, 'k03pr4Web-BE/src/services/payments/payment-confirmation.service.ts'), 'utf8')
const portalFulfillment = readFileSync(resolve(root, 'k03pr4p05-be/src/graphql/resolvers/purchaseOrder/purchaseOrder.mutation.ts'), 'utf8')
const deliveryMutation = readFileSync(resolve(root, 'k03pr4p05-be/src/graphql/resolvers/delivery/delivery.mutation.ts'), 'utf8')
const deliveryScreen = readFileSync(resolve(root, 'k03pr4p05-fe/screens/supplier/DeliveryScreen.tsx'), 'utf8')
const deliveryDetail = readFileSync(resolve(root, 'k03pr4p05-fe/screens/supplier/DeliveryDetailsScreen.tsx'), 'utf8')

let passed = 0
function check(name: string, assertion: () => void) {
  assertion()
  passed += 1
  console.info(`PASS ${String(passed).padStart(2, '0')} ${name}`)
}

check('unpaid PENDING cancellation is direct and requires no refund', () => {
  assert.equal(purchaseOrderCancellationMode('PENDING'), 'DIRECT')
  assert.equal(cancellationRequiresRefund(false), false)
})
check('unpaid SUPPLIER_ACCEPTED cancellation is direct and requires no refund', () => {
  assert.equal(purchaseOrderCancellationMode('SUPPLIER_ACCEPTED'), 'DIRECT')
  assert.equal(cancellationRequiresRefund(false), false)
})
check('paid pre-preparation cancellation creates a manual-refund liability', () => {
  assert.equal(cancellationRequiresRefund(true), true)
  assert.match(webService, /REQUIRES_MANUAL_REFUND/)
})
check('duplicate cancellation converges on the canonical row', () => {
  assert.match(webService, /po\.status === 'CANCELLED'/)
  assert.match(webService, /toResult\(po, existing, refund, true\)/)
  assert.match(webService, /purchaseOrderCancellation\.upsert/)
})
check('duplicate provider refund completion is idempotent', () => {
  assert.match(webService, /refund\.status === 'REFUNDED'/)
  assert.match(webService, /changed: false/)
})
check('PREPARING cancellation requires approval', () => assert.equal(purchaseOrderCancellationMode('PREPARING'), 'REQUEST_APPROVAL'))
check('READY_FOR_DISPATCH cancellation requires approval', () => assert.equal(purchaseOrderCancellationMode('READY_FOR_DISPATCH'), 'REQUEST_APPROVAL'))
check('IN_TRANSIT ordinary cancellation is rejected', () => assert.equal(purchaseOrderCancellationMode('IN_TRANSIT'), 'RETURN_OR_DISPUTE'))
check('DELIVERED ordinary cancellation is rejected', () => assert.equal(purchaseOrderCancellationMode('DELIVERED'), 'RETURN_OR_DISPUTE'))
check('COMPLETED ordinary cancellation is rejected', () => assert.equal(purchaseOrderCancellationMode('COMPLETED'), 'RETURN_OR_DISPUTE'))
check('cancellation does not invent Supplier inventory addback', () => {
  assert.doesNotMatch(webService, /supplierItem\.(update|updateMany)/)
  assert.doesNotMatch(webService, /reservedQty/)
})
check('cancelled or pending-cancellation PO cannot dispatch', () => {
  assert.match(deliveryMutation, /po\.status !== 'READY_FOR_DISPATCH'/)
  assert.match(deliveryMutation, /cancellation\?\.status === 'REQUESTED'/)
  assert.match(portalFulfillment, /Resolve the pending cancellation request/)
})
check('cancelled PO cannot be marked delivered', () => assert.match(deliveryMutation, /po\.status !== 'IN_TRANSIT'/))
check('Scheduled to In Transit refetches canonical list and detail', () => {
  assert.match(deliveryScreen, /Promise\.all\(\[fetchDeliveries\(user\.orgId\), fetchDeliveryByPOId\(poId\)\]\)/)
  assert.match(deliveryDetail, /await startDelivery\(delivery\.poId\); await load\(\)/)
})
check('In Transit to Delivered refetches canonical list and detail', () => assert.match(deliveryDetail, /await markDelivered\(delivery\.poId\); await load\(\)/))
check('list and selected delivery use the same canonical refresh result', () => {
  assert.match(deliveryScreen, /onRefreshCanonical=\{syncDelivery\}/)
  assert.match(deliveryDetail, /setDelivery\(d\)/)
})
check('realtime Purchase Order events refresh the selected delivery', () => {
  assert.match(deliveryScreen, /message\.event\?\.startsWith\('purchaseOrder:'\)/)
  assert.match(deliveryScreen, /changedPOId === selectedPOId/)
})
check('refetch preserves filter, date, sort, and layout state', () => {
  for (const state of ['setSearch', 'setStatus', 'setDateRange', 'setSort', 'setLayout']) {
    assert.doesNotMatch(deliveryScreen.match(/const syncDelivery[\s\S]*?\}, \[user/)?.[0] ?? '', new RegExp(`${state}\\(`))
  }
})

check('authoritative refund reversal preserves accounting invariants', () => {
  assert.match(webService, /heldBalance: \{ decrement: payment\.netAmount \}/)
  assert.match(webService, /sourceType: 'ESCROW_REVERSAL'/)
  assert.match(webService, /data: \{ status: 'REVERSED' \}/)
  assert.doesNotMatch(webService, /balance: \{ increment: payment\.netAmount \}/)
  assert.match(webService, /purchaseOrderSettlement\.findUnique/)
})
check('late payment after cancellation creates the same refund liability', () => {
  assert.match(paymentConfirmation, /po\.status === 'CANCELLED'/)
  assert.match(paymentConfirmation, /paymentRefund\.upsert/)
  assert.match(paymentConfirmation, /REQUIRES_MANUAL_REFUND/)
})

console.info(`Purchase Order cancellation verifier passed ${passed} deterministic checks.`)
