import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const service = read('k03pr4p05-be/src/services/notification.service.ts')
const typeDef = read('k03pr4p05-be/src/graphql/typeDefs/notification.type.ts')
const schema = read('k03pr4p05-be/prisma/schema.prisma')
const context = read('k03pr4p05-fe/contexts/NotificationContext.tsx')
const screen = read('k03pr4p05-fe/screens/shared/NotificationsScreen.tsx')
const config = read('k03pr4p05-fe/components/notifications/notificationConfig.ts')
const supplierRoute = read('k03pr4p05-fe/app/(supplier)/notifications.tsx')
const retailRoute = read('k03pr4p05-fe/app/(erp)/notifications.tsx')
const adminLayout = read('k03pr4p05-fe/app/(admin)/_layout.tsx')
const supplierLayout = read('k03pr4p05-fe/components/supplier/SupplierLayout.tsx')
const retailLayout = read('k03pr4p05-fe/components/erp/ERPLayout.tsx')

const checks: Array<[string, () => void]> = [
  ['additive recipient and reference metadata exists', () => {
    assert.match(schema, /recipientAudience\s+NotificationRecipientAudience/)
    assert.match(schema, /referenceType\s+String\?/) 
    assert.match(schema, /referenceId\s+String\?/) 
    assert.match(schema, /PLATFORM_ADMIN/)
  }],
  ['page is server-paginated and bounded', () => {
    assert.match(service, /Math\.min\(pageSizeValue, 50\)/)
    assert.match(service, /skip: \(page - 1\) \* pageSize/)
    assert.match(service, /take: pageSize/)
  }],
  ['scopes distinguish organization accounts from platform admins', () => {
    assert.match(service, /recipientAudience: 'PLATFORM_ADMIN'/)
    assert.match(service, /recipientAudience: 'ACCOUNT'/)
    assert.match(typeDef, /requireNotificationScope/)
    assert.match(typeDef, /requireRole\(ctx, \['ADMIN'\]\)/)
  }],
  ['read operations remain scoped and idempotent', () => {
    assert.match(service, /findFirst\(\{ where: \{ id, \.\.\.scopeWhere, deletedAt: null \} \}\)/)
    assert.match(service, /if \(!existing\.isRead\)/)
    assert.match(service, /if \(count > 0\)/)
  }],
  ['realtime events carry recipient audience and canonical category', () => {
    assert.match(service, /recipientAudience: 'ACCOUNT'/)
    assert.match(service, /recipientAudience: 'PLATFORM_ADMIN'/)
    assert.match(service, /category: categorizeNotification\(notification\)/)
  }],
  ['one shared context subscription deduplicates websocket payloads', () => {
    assert.match(context, /const seenIds = useRef\(new Set<number>\(\)\)/)
    assert.match(context, /seenIds\.current\.has\(id\)/)
    assert.match(context, /useEffect\(\(\) => subscribe/)
  }],
  ['admin client ignores organization audience payloads', () => assert.match(context, /accountContext === 'ADMIN' && payload\.recipientAudience !== 'PLATFORM_ADMIN'/)],
  ['shared screen handles loading errors refresh and append pagination', () => {
    assert.match(screen, /SkeletonBox/)
    assert.match(screen, /Retry/)
    assert.match(screen, /RefreshControl/)
    assert.match(screen, /Load More/)
    assert.match(screen, /dedupe/)
  }],
  ['shared config owns filters category visuals and destinations', () => {
    assert.match(config, /NOTIFICATION_FILTERS/)
    assert.match(config, /NOTIFICATION_CATEGORY_PRESENTATION/)
    assert.match(config, /resolveNotificationDestination/)
  }],
  ['all three role surfaces use the shared center', () => {
    assert.match(supplierRoute, /accountContext="SUPPLIER"/)
    assert.match(retailRoute, /accountContext="RETAIL"/)
    assert.match(adminLayout, /accountContext="ADMIN"/)
  }],
  ['shell badges use the shared unread source', () => {
    assert.match(supplierLayout, /<NotificationBell accountContext="SUPPLIER"/)
    assert.match(retailLayout, /<NotificationBell accountContext="RETAIL"/)
    assert.match(adminLayout, /<NotificationBell accountContext="ADMIN"/)
  }],
  ['notification center has no payment settlement or wallet mutation path', () => {
    assert.doesNotMatch(service, /PaymentTransaction\.create|PurchaseOrderSettlement\.create|wallet.*update/i)
  }],
]

for (const [name, check] of checks) {
  check()
  console.info(`PASS ${name}`)
}

console.info(`Notification center verifier passed ${checks.length} checks.`)
