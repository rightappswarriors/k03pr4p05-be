import { extendType, intArg, nonNull, stringArg } from 'nexus'
import { listSupplierItemReviews } from '../../../services/supplierItemReview.service.js'
import { listOrganizationReviews } from '../../../services/organizationReview.service.js'

export const ReviewQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.field('supplierItemReviews', {
      type: 'SupplierItemReviewPayload',
      args: { supplierItemId: nonNull(stringArg()) },
      resolve: async (_, { supplierItemId }, ctx) => listSupplierItemReviews(ctx.prisma, supplierItemId),
    })

    t.nonNull.field('organizationReviews', {
      type: 'OrganizationReviewPayload',
      args: { organizationId: nonNull(intArg()) },
      resolve: async (_, { organizationId }, ctx) => listOrganizationReviews(ctx.prisma, organizationId),
    })
  },
})
