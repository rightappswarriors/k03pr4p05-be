import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '..')
const detail = readFileSync(resolve(root, 'k03pr4p05-fe/screens/supplier/DeliveryDetailsScreen.tsx'), 'utf8')
const deliveryScreen = readFileSync(resolve(root, 'k03pr4p05-fe/screens/supplier/DeliveryScreen.tsx'), 'utf8')
const poRoute = readFileSync(resolve(root, 'k03pr4p05-fe/app/(supplier)/po-inbox.tsx'), 'utf8')
const poDetailRoute = readFileSync(resolve(root, 'k03pr4p05-fe/app/(supplier)/po-inbox/[id].tsx'), 'utf8')

const checks: Array<[string, () => void]> = [
  ['delivery timeline remains Scheduled, In Transit, Delivered', () => {
    assert.match(detail, /key: 'SCHEDULED', label: 'Scheduled'/)
    assert.match(detail, /key: 'IN_TRANSIT', label: 'In Transit'/)
    assert.match(detail, /key: 'DELIVERED', label: 'Delivered'/)
    assert.doesNotMatch(detail, /READY_FOR_DISPATCH.*label|label.*READY_FOR_DISPATCH/)
  }],
  ['Supplier Accepted scheduled delivery explains preparation blocker', () => assert.match(detail, /Waiting for order preparation/)],
  ['Preparing scheduled delivery explains Ready for Dispatch prerequisite', () => assert.match(detail, /Mark the purchase order Ready for Dispatch before starting this delivery/)],
  ['pending cancellation takes priority over fulfillment actions', () => {
    assert.match(detail, /Cancellation request pending/)
    assert.match(detail, /!cancellationPending && !isCancelled/)
  }],
  ['cancelled delivery is read-only with a PO link', () => {
    assert.match(detail, /Order cancelled/)
    assert.match(detail, /This delivery is no longer active because the purchase order was cancelled/)
    assert.match(detail, /delivery\.status === 'CANCELLED' \|\| delivery\.poStatus === 'CANCELLED'/)
  }],
  ['canonical delivery actions remain server-gated', () => {
    assert.match(detail, /canEdit && delivery\.status === 'SCHEDULED' && delivery\.poStatus === 'READY_FOR_DISPATCH'/)
    assert.match(detail, /canEdit && delivery\.status === 'IN_TRANSIT'/)
  }],
  ['View Purchase Order uses the exact database PO ID', () => {
    assert.match(detail, /onViewPurchaseOrder\?\.\(exactPoId\)/)
    assert.match(deliveryScreen, /onViewPurchaseOrder=\{openPurchaseOrder\}/)
    assert.match(deliveryScreen, /pathname: '\/\(supplier\)\/po-inbox\/\[id\]'/)
    assert.match(deliveryScreen, /params: \{ id: exactPoId \}/)
  }],
  ['PO list links to the canonical detail route, which opens the established PODetailScreen', () => {
    assert.match(poRoute, /useLocalSearchParams/)
    assert.match(poRoute, /pathname: '\/\(supplier\)\/po-inbox\/\[id\]'/)
    assert.match(poDetailRoute, /<PODetailScreen/)
  }],
]

for (const [name, check] of checks) {
  check()
  console.info(`PASS ${name}`)
}

console.info(`Delivery detail UX verifier passed ${checks.length} checks.`)
