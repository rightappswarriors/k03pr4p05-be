import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const config = read('k03pr4p05-fe/components/notifications/notificationConfig.ts')
const inboxRoute = read('k03pr4p05-fe/app/(supplier)/po-inbox.tsx')
const rfqDetail = read('k03pr4p05-fe/screens/supplier/RFQDetailScreen.tsx')
const poRoute = read('k03pr4p05-fe/app/(supplier)/po-inbox/[id].tsx')
const notificationScreen = read('k03pr4p05-fe/screens/shared/NotificationsScreen.tsx')
const rfqService = read('k03pr4Web-BE/src/services/rfq.service.ts')
const conversationService = read('k03pr4Web-BE/src/services/conversation.service.ts')
const negotiationService = read('k03pr4Web-BE/src/services/rfqNegotiation.service.ts')

const checks: Array<[string, () => void]> = [
  ['central resolver uses canonical PO and RFQ destinations only from structured references', () => {
    assert.match(config, /normalizeNotificationReferenceType/)
    assert.match(config, /pathname: '\/\(supplier\)\/po-inbox\/\[id\]'/)
    assert.match(config, /params: \{ id: referenceId \}/)
    assert.match(config, /pathname: '\/\(supplier\)\/po-inbox', params: \{ rfqId: referenceId \}/)
    assert.doesNotMatch(config, /match\(.*rfqNumber|#RFQ/i)
  }],
  ['RFQ deep link selects the supplied ID, waits for permissions, and clears the URL on close', () => {
    assert.match(inboxRoute, /useLocalSearchParams<\{ purchaseOrderId\?: string; rfqId\?: string \}>/)
    assert.match(inboxRoute, /setSelectedRfqId\(exactRfqId\.trim\(\)\)/)
    assert.match(inboxRoute, /if \(permissionsLoading\) return null/)
    assert.match(inboxRoute, /router\.replace\('\/\(supplier\)\/po-inbox' as never\)/)
    assert.match(inboxRoute, /<RFQDetailScreen/)
  }],
  ['RFQ detail performs one authorized detail load and has a safe unavailable state', () => {
    assert.match(rfqDetail, /fetchSupplierRfqDetail\(rfqId\)/)
    assert.match(rfqDetail, /Related record is no longer available/)
    assert.match(rfqDetail, /useConversation/)
  }],
  ['PO notifications remain route-driven through PODetailScreen', () => {
    assert.match(poRoute, /<PODetailScreen poId=\{purchaseOrderId\}/)
    assert.doesNotMatch(inboxRoute, /selectedPoId/)
  }],
  ['notification click preserves scoped mark-read before centralized navigation', () => {
    assert.match(notificationScreen, /await markNotificationRead\(accountContext, notification\.id\)/)
    assert.match(notificationScreen, /resolveNotificationDestination\(notification, accountContext\)/)
  }],
  ['new Marketplace RFQ notifications persist canonical RFQ identities', () => {
    for (const source of [rfqService, conversationService, negotiationService]) {
      assert.match(source, /referenceType: "RFQ"/)
      assert.match(source, /referenceId: rfq\.id/)
    }
  }],
  ['new Marketplace PO notifications persist PurchaseOrder IDs, not PO numbers', () => {
    assert.match(negotiationService, /referenceType: "PURCHASE_ORDER"/)
    assert.match(negotiationService, /referenceId: result\.po\.id/)
    assert.doesNotMatch(negotiationService, /referenceId:\s*result\.po\.poNumber/)
  }],
]

for (const [name, check] of checks) {
  check()
  console.info(`PASS ${name}`)
}

console.info(`Notification record navigation verifier passed ${checks.length} checks.`)
