import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const supplierList = read('k03pr4p05-fe/app/(supplier)/po-inbox.tsx')
const supplierDetail = read('k03pr4p05-fe/app/(supplier)/po-inbox/[id].tsx')
const supplierDetailScreen = read('k03pr4p05-fe/screens/supplier/PODetailScreen.tsx')
const supplierLayout = read('k03pr4p05-fe/components/supplier/SupplierLayout.tsx')
const delivery = read('k03pr4p05-fe/screens/supplier/DeliveryScreen.tsx')
const notificationConfig = read('k03pr4p05-fe/components/notifications/notificationConfig.ts')
const retailDetail = read('k03pr4p05-fe/app/(erp)/supplier-links/orders/[id].tsx')
const retailList = read('k03pr4p05-fe/screens/retailer/RetailerPurchaseOrdersScreen.tsx')
const retailCatalog = read('k03pr4p05-fe/screens/retailer/RetailerSupplierCatalogScreen.tsx')
const legacyRetail = read('k03pr4p05-fe/app/(erp)/purchase-orders/[id].tsx')
const analytics = read('k03pr4p05-fe/screens/supplier/SupplierAnalyticsScreen.tsx')

const checks: Array<[string, () => void]> = [
  ['Supplier list pushes the persisted PO ID to its dynamic route', () => {
    assert.match(supplierList, /pathname: '\/\(supplier\)\/po-inbox\/\[id\]'/)
    assert.match(supplierList, /params: \{ id: exactPoId \}/)
    assert.doesNotMatch(supplierList, /const \[selectedPoId/)
  }],
  ['legacy Supplier query URL redirects to the dynamic route', () => assert.match(supplierList, /router\.replace\(\{ pathname: '\/\(supplier\)\/po-inbox\/\[id\]'/)],
  ['Supplier detail route normalizes ID before rendering the existing detail screen', () => {
    assert.match(supplierDetail, /normalizePurchaseOrderId/)
    assert.match(supplierDetail, /supplierPurchaseOrderPage', 'canView'/)
    assert.match(supplierDetail, /<PODetailScreen poId=\{purchaseOrderId\}/)
    assert.match(supplierDetail, /Purchase order unavailable/)
  }],
  ['Supplier layout maps canonical PO detail URLs to the Purchase Orders permission scope', () => assert.match(supplierLayout, /pathname\.startsWith\('\/po-inbox\/'\)/)],
  ['Supplier unavailable detail retains the safe unavailable message', () => assert.match(supplierDetailScreen, /This purchase order could not be found or you no longer have access to it/)],
  ['Delivery opens the same Supplier canonical PO route by delivery.poId', () => {
    assert.match(delivery, /pathname: '\/\(supplier\)\/po-inbox\/\[id\]'/)
    assert.match(delivery, /params: \{ id: exactPoId \}/)
    assert.doesNotMatch(delivery, /params: \{ purchaseOrderId: exactPoId \}/)
  }],
  ['notification resolver centralizes Supplier and Retail PO destinations', () => {
    assert.match(notificationConfig, /'\/\(supplier\)\/po-inbox\/\[id\]'/)
    assert.match(notificationConfig, /'\/\(erp\)\/supplier-links\/orders\/\[id\]'/)
    assert.match(notificationConfig, /params: \{ id: referenceId \}/)
  }],
  ['Retail has one canonical dynamic PO wrapper and existing screen reuse', () => {
    assert.match(retailDetail, /<RetailerPurchaseOrderDetailScreen/)
    assert.match(retailDetail, /supplierLinksPage', 'canView'/)
    assert.match(retailDetail, /Purchase order unavailable/)
  }],
  ['Retail list and creation success use the canonical PO route', () => {
    assert.match(retailList, /\/\(erp\)\/supplier-links\/orders\/\$\{po\.id\}/)
    assert.match(retailCatalog, /\/\(erp\)\/supplier-links\/orders\/\$\{poId\}/)
  }],
  ['legacy Retail detail URL redirects instead of becoming a second canonical screen', () => assert.match(legacyRetail, /router\.replace\(exactId \? `\/\(erp\)\/supplier-links\/orders\/\$\{exactId\}`/)],
  ['Supplier analytics routes PO IDs instead of mounting another PODetailScreen', () => {
    assert.match(analytics, /pathname: '\/\(supplier\)\/po-inbox\/\[id\]'/)
    assert.doesNotMatch(analytics, /<PODetailScreen/)
  }],
]

for (const [name, check] of checks) {
  check()
  console.info(`PASS ${name}`)
}

console.info(`PO deep-link verifier passed ${checks.length} checks.`)
