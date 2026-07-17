// Marketplace readiness validation — runs before any publish attempt.
import type { PrismaClient } from '@prisma/client'

export interface ValidationResult {
  isPublishable: boolean
  errors: string[]   // blocking — must fix before publish
  warnings: string[] // non-blocking — improve listing quality
  score: number      // 0-100 readiness score
}

interface ValidationItem {
  id: string
  name: string | null
  description: string | null
  sku: string | null
  unit: string | null
  unitPrice: number
  moq: number
  availableQty: number
  isActive: boolean
  image: string | null
  categoryId: string | null
  priceTiers: Array<{ minQty: number; price: number }>
  catalog: {
    organizationId: number
    organization: {
      verificationStatus: string
      isDevSeed?: boolean
      supplierWarehouses?: Array<{ isDefault: boolean }>
    }
  }
  supplierScheduledPrices?: Array<{ startsAt: string }>
}

// Validate marketplace readiness for a supplier item.
export async function validateMarketplaceReadiness(
  prisma: PrismaClient,
  supplierItemId: string,
): Promise<ValidationResult> {
  const item = await prisma.supplierItem.findUnique({
    where: { id: supplierItemId },
    include: {
      priceTiers: true,
      supplierScheduledPrices: { where: { deletedAt: null } },
      catalog: {
        include: {
          organization: {
            include: { supplierWarehouses: { where: { deletedAt: null } } },
          },
        },
      },
    },
  }) as unknown as ValidationItem | null

  if (!item) {
    return { isPublishable: false, errors: ['Item not found.'], warnings: [], score: 0 }
  }

  const errors: string[] = []
  const warnings: string[] = []
  let checks = 0
  let passed = 0

  // ── Basic Information ───────────────────────────────────────────────
  checks += 5

  if (!item.name?.trim()) {
    errors.push('Product name is required.')
  } else passed++

  if (!item.description?.trim()) {
    errors.push('Product description is required.')
  } else passed++

  if (!item.categoryId) {
    errors.push('Category is required.')
  } else passed++

  if (!item.sku?.trim()) {
    errors.push('SKU is required.')
  } else passed++

  if (!item.unit?.trim()) {
    errors.push('Unit of measure is required.')
  } else passed++

  // ── Image ───────────────────────────────────────────────────────────
  checks += 1
  // Count via the image field (single image for now — multi-image is a Phase 2 feature)
  const imageCount = item.image ? 1 : 0
  if (imageCount === 0) {
    errors.push('At least one product image is required.')
  } else {
    passed++
    if (imageCount < 3) {
      warnings.push('Uploading 3+ images improves buyer confidence and search ranking.')
    }
  }

  // ── Pricing ─────────────────────────────────────────────────────────
  checks += 1
  if (item.unitPrice <= 0) {
    errors.push('Unit price must be greater than zero.')
  } else {
    passed++
    // Validate price tiers if present
    if (item.priceTiers.length > 0) {
      const firstTierMin = Math.min(...item.priceTiers.map((t) => t.minQty))
      if (item.moq > firstTierMin) {
        warnings.push(`MOQ (${item.moq}) exceeds first price tier minimum quantity (${firstTierMin}).`)
      }
    }
  }

  // ── MOQ ─────────────────────────────────────────────────────────────
  checks += 1
  if (item.moq < 1) {
    errors.push('Minimum order quantity must be at least 1.')
  } else passed++

  // ── Inventory ───────────────────────────────────────────────────────
  checks += 1
  if (item.availableQty <= 0) {
    errors.push('Available quantity must be greater than 0.')
  } else passed++

  // ── Item active status ───────────────────────────────────────────────
  checks += 1
  if (!item.isActive) {
    errors.push('Item must be active before it can be published.')
  } else passed++

  // ── Verification ─────────────────────────────────────────────────────
  checks += 1
  const org = item.catalog.organization
  if (org.verificationStatus !== 'VERIFIED') {
    errors.push('Your organization must be verified before publishing to the marketplace.')
  } else passed++

  // ── Warehouse ────────────────────────────────────────────────────────
  checks += 1
  const warehouses = org.supplierWarehouses ?? []
  const hasDefault = warehouses.some((w) => w.isDefault)
  if (warehouses.length === 0) {
    warnings.push('No warehouse configured. Adding a default warehouse improves delivery estimates.')
    passed++ // not blocking
  } else if (!hasDefault) {
    warnings.push('No default warehouse set. Buyers use this for delivery scheduling.')
    passed++
  } else {
    passed++
  }

  // ── Scheduled pricing edge-case ──────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const scheduledPrices = (item.supplierScheduledPrices ?? []) as Array<{ startsAt: string }>
  for (const sp of scheduledPrices) {
    const startDate = new Date(sp.startsAt)
    startDate.setHours(0, 0, 0, 0)
    if (startDate.getTime() === today.getTime()) {
      warnings.push('A scheduled price change takes effect today. Verify the price is correct before publishing.')
    }
  }

  const score = checks > 0 ? Math.round((passed / checks) * 100) : 0
  const isPublishable = errors.length === 0

  return { isPublishable, errors, warnings, score }
}
