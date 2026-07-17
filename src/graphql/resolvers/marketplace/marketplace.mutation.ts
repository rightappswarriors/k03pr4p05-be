// Marketplace GraphQL mutations — publish, unpublish, validate.
import { extendType, nonNull, stringArg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { validateMarketplaceReadiness } from '../../../services/marketplaceValidation.service.js'

export const MarketplaceMutation = extendType({
  type: 'Mutation',
  definition(t) {

    // Run validation and return readiness result without side-effects.
    t.nonNull.field('validateMarketplaceItem', {
      type: 'MarketplaceReadiness',
      args: {
        supplierItemId: nonNull(stringArg()),
      },
      resolve: async (_, { supplierItemId }, ctx) => {
        requireAuth(ctx)
        const result = await validateMarketplaceReadiness(ctx.prisma, supplierItemId)
        return { supplierItemId, ...result }
      },
    })

    // Publish listing — validates first, then upserts with PUBLISHED status.
    t.nonNull.field('publishMarketplaceItem', {
      type: 'MarketplaceListing',
      args: {
        supplierItemId: nonNull(stringArg()),
      },
      resolve: async (_, { supplierItemId }, ctx) => {
        requireAuth(ctx)
        const userId = ctx.user?.id
        const orgId = ctx.user?.orgId

        // Validate before publishing.
        const validation = await validateMarketplaceReadiness(ctx.prisma, supplierItemId)
        if (!validation.isPublishable) {
          throw new Error(
            `Cannot publish: ${validation.errors.join(' | ')}`,
          )
        }

        const now = new Date()

        // Upsert the listing.
        const listing = await ctx.prisma.marketplaceListing.upsert({
          where: { supplierItemId },
          create: {
            supplierItemId,
            status: 'PUBLISHED',
            publishedAt: now,
          },
          update: {
            status: 'PUBLISHED',
            publishedAt: now,
            unpublishedAt: null,
            deletedAt: null,
          },
        })

        // Audit log.
        if (userId && orgId) {
          await ctx.prisma.auditLog.create({
            data: {
              orgId,
              userId,
              pageKey: 'catalogPage',
              action: 'MARKETPLACE_PUBLISH',
              recordId: listing.id,
              recordType: 'MarketplaceListing',
              newValue: { supplierItemId, status: 'PUBLISHED' },
            },
          })
        }

        return listing
      },
    })

    // Unpublish — sets status to ARCHIVED, records unpublishedAt.
    t.nonNull.field('unpublishMarketplaceItem', {
      type: 'MarketplaceListing',
      args: {
        supplierItemId: nonNull(stringArg()),
      },
      resolve: async (_, { supplierItemId }, ctx) => {
        requireAuth(ctx)
        const userId = ctx.user?.id
        const orgId = ctx.user?.orgId

        const existing = await ctx.prisma.marketplaceListing.findUnique({
          where: { supplierItemId },
        })
        if (!existing) {
          throw new Error('No marketplace listing found for this item.')
        }

        const listing = await ctx.prisma.marketplaceListing.update({
          where: { supplierItemId },
          data: {
            status: 'ARCHIVED',
            unpublishedAt: new Date(),
          },
        })

        // Audit log.
        if (userId && orgId) {
          await ctx.prisma.auditLog.create({
            data: {
              orgId,
              userId,
              pageKey: 'catalogPage',
              action: 'MARKETPLACE_UNPUBLISH',
              recordId: listing.id,
              recordType: 'MarketplaceListing',
              newValue: { supplierItemId, status: 'ARCHIVED' },
            },
          })
        }

        return listing
      },
    })
  },
})
