// Nexus object types for marketplace publishing.
import { objectType, enumType, inputObjectType } from 'nexus'

// Status enum mirrors the Prisma MarketplaceListingStatus enum.
export const MarketplaceListingStatusEnum = enumType({
  name: 'MarketplaceListingStatus',
  members: ['DRAFT', 'READY', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED'],
})

// Core listing type — one per SupplierItem.
export const MarketplaceListingType = objectType({
  name: 'MarketplaceListing',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('supplierItemId')
    t.nonNull.field('status', { type: 'MarketplaceListingStatus' })
    t.nullable.string('publishedAt')
    t.nullable.string('unpublishedAt')
    t.nonNull.boolean('featured')
    t.nonNull.int('searchRank')
    t.nonNull.int('views')
    t.nonNull.int('clicks')
    t.nonNull.int('inquiries')
    t.nonNull.string('createdAt')
    t.nonNull.string('updatedAt')
    t.nullable.string('deletedAt')
  },
})

// Readiness check result returned by marketplaceReadiness query and
// validateMarketplaceItem mutation.
export const MarketplaceReadinessType = objectType({
  name: 'MarketplaceReadiness',
  definition(t) {
    t.nonNull.string('supplierItemId')
    t.nonNull.boolean('isPublishable')
    t.nonNull.list.nonNull.string('errors')
    t.nonNull.list.nonNull.string('warnings')
    t.nonNull.int('score')
  },
})
