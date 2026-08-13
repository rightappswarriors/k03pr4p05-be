// Marketplace GraphQL queries.
import { extendType, nonNull, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateMarketplaceReadiness } from '../../../services/marketplaceValidation.service.js';
export const MarketplaceQuery = extendType({
    type: 'Query',
    definition(t) {
        // Fetch a single listing by supplierItemId.
        t.nullable.field('marketplaceListing', {
            type: 'MarketplaceListing',
            args: {
                supplierItemId: nonNull(stringArg()),
            },
            resolve: async (_, { supplierItemId }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.marketplaceListing.findUnique({
                    where: { supplierItemId },
                });
            },
        });
        // Fetch all listings for the authenticated supplier's catalog.
        t.nonNull.list.nonNull.field('marketplaceListings', {
            type: 'MarketplaceListing',
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                const orgId = ctx.user?.orgId;
                const catalog = await ctx.prisma.supplierCatalog.findUnique({
                    where: { organizationId: orgId },
                    select: { id: true },
                });
                if (!catalog)
                    return [];
                return ctx.prisma.marketplaceListing.findMany({
                    where: {
                        deletedAt: null,
                        supplierItem: { catalogId: catalog.id },
                    },
                    orderBy: { updatedAt: 'desc' },
                });
            },
        });
        // Run readiness validation without publishing — powers the Readiness Modal.
        t.nonNull.field('marketplaceReadiness', {
            type: 'MarketplaceReadiness',
            args: {
                supplierItemId: nonNull(stringArg()),
            },
            resolve: async (_, { supplierItemId }, ctx) => {
                requireAuth(ctx);
                const result = await validateMarketplaceReadiness(ctx.prisma, supplierItemId);
                return { supplierItemId, ...result };
            },
        });
    },
});
