import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '..')
const resolver = readFileSync(resolve(root, 'k03pr4p05-be/src/graphql/resolvers/purchaseOrder/purchaseOrder.query.ts'), 'utf8')
const service = readFileSync(resolve(root, 'k03pr4p05-fe/services/supplierService/supplierService.ts'), 'utf8')
const screen = readFileSync(resolve(root, 'k03pr4p05-fe/screens/supplier/POInboxScreen.tsx'), 'utf8')

const checks: Array<[string, () => void]> = [
  ['paged query keeps the Supplier permission and organization scope', () => {
    assert.match(resolver, /supplierPurchaseOrderPage/)
    assert.match(resolver, /PAGE_PERMISSIONS\.supplierPurchaseOrders\.view\(ctx\)/)
    assert.match(resolver, /requireSupplierOrganizationScope\(ctx, supplierOrgId\)/)
  }],
  ['backend page is database-paginated with a bounded page size', () => {
    assert.match(resolver, /safePageSize = Math\.min\(100, Math\.max\(1, pageSize \?\? 20\)\)/)
    assert.match(resolver, /skip: \(safePage - 1\) \* safePageSize/)
    assert.match(resolver, /take: safePageSize/)
  }],
  ['page metadata includes total and has-next state', () => {
    assert.match(resolver, /purchaseOrder\.count\(\{ where \}\)/)
    assert.match(resolver, /hasNextPage: safePage \* safePageSize < total/)
  }],
  ['KPI summary is computed across the Supplier scope, not the active page', () => {
    assert.match(resolver, /purchaseOrder\.groupBy/)
    assert.match(resolver, /where: \{ supplierOrgId \}/)
    assert.match(resolver, /accepted: \(counts\.get\('SUPPLIER_ACCEPTED'\)/)
  }],
  ['frontend service requests the page contract and metadata', () => {
    assert.match(service, /fetchSupplierPurchaseOrderPage/)
    assert.match(service, /supplierPurchaseOrderPage\(supplierOrgId: \$supplierOrgId, status: \$status, page: \$page, pageSize: \$pageSize\)/)
    assert.match(service, /summary \{ total pending accepted delivered \}/)
  }],
  ['initial and refresh loads replace page one', () => {
    assert.match(screen, /const loadPos = useCallback\(async \(targetPage = 1, append = false\)/)
    assert.match(screen, /append \? mergePurchaseOrderPages\(current, data\.items\) : data\.items/)
    assert.match(screen, /await loadPos\(\)/)
  }],
  ['Load More appends the next page only when one exists', () => {
    assert.match(screen, /loadPos\(poPage \+ 1, true\)/)
    assert.match(screen, /poLoading \|\| poLoadingMore \|\| !poHasNextPage/)
    assert.match(screen, />Load More</)
  }],
  ['append path deduplicates by PO ID and uses the latest row', () => {
    assert.match(screen, /function mergePurchaseOrderPages/)
    assert.match(screen, /const indexById = new Map/)
    assert.match(screen, /merged\[existingIndex\] = po/)
  }],
  ['PO tabs and KPIs use canonical server summary values', () => {
    assert.match(screen, /count=\{poSummary\.total\}/)
    assert.match(screen, /value=\{poSummary\.pending\}/)
    assert.match(screen, /value=\{poSummary\.accepted\}/)
    assert.match(screen, /value=\{poSummary\.delivered\}/)
  }],
  ['realtime updates loaded rows in place and keeps distinct accepted labels', () => {
    assert.match(screen, /fetchPurchaseOrder\(poId\)/)
    assert.match(screen, /const index = current\.findIndex/)
    assert.match(screen, /SUPPLIER_ACCEPTED: 'Supplier Accepted'/)
    assert.match(screen, /ACCEPTED: 'Accepted'/)
  }],
]

for (const [name, check] of checks) {
  check()
  console.info(`PASS ${name}`)
}

console.info(`Supplier PO append-pagination verifier passed ${checks.length} checks.`)
