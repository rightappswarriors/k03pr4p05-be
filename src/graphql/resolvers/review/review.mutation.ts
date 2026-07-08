import { extendType, intArg, nonNull, nullable, stringArg } from 'nexus'
import {
  createSupplierItemReview,
  deleteSupplierItemReview,
  updateSupplierItemReview,
} from '../../../services/supplierItemReview.service.js'
import {
  createOrganizationReview,
  deleteOrganizationReview,
  updateOrganizationReview,
} from '../../../services/organizationReview.service.js'

function reviewerOrgId(ctx: any) {
  const orgId = ctx.user?.orgId
  if (!orgId) throw new Error('Authentication required.')
  return orgId
}

function optionalReviewerOrgId(ctx: any) {
  return ctx.user?.orgId ?? null
}

export const ReviewMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('createSupplierItemReview', {
      type: 'SupplierItemReview',
      args: {
        supplierItemId: nonNull(stringArg()),
        rating: nonNull(intArg()),
        title: nullable(stringArg()),
        comment: nullable(stringArg()),
      },
      resolve: async (_, args, ctx) => createSupplierItemReview(ctx.prisma, { ...args, reviewerOrgId: reviewerOrgId(ctx) }),
    })

    t.nonNull.field('updateSupplierItemReview', {
      type: 'SupplierItemReview',
      args: {
        id: nonNull(stringArg()),
        rating: nullable(intArg()),
        title: nullable(stringArg()),
        comment: nullable(stringArg()),
      },
      resolve: async (_, args, ctx) => updateSupplierItemReview(ctx.prisma, { ...args, reviewerOrgId: reviewerOrgId(ctx) }),
    })

    t.nonNull.field('deleteSupplierItemReview', {
      type: 'SupplierItemReview',
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => deleteSupplierItemReview(ctx.prisma, id, reviewerOrgId(ctx)),
    })

    t.nonNull.field('createOrganizationReview', {
      type: 'OrganizationReview',
      args: {
        organizationId: nonNull(intArg()),
        reviewerCustomerId: nullable(intArg()),
        reviewerName: nullable(stringArg()),
        rating: nonNull(intArg()),
        title: nullable(stringArg()),
        comment: nullable(stringArg()),
      },
      resolve: async (_, args, ctx) => createOrganizationReview(ctx.prisma, { ...args, reviewerOrgId: optionalReviewerOrgId(ctx) }),
    })

    t.nonNull.field('updateOrganizationReview', {
      type: 'OrganizationReview',
      args: {
        id: nonNull(stringArg()),
        rating: nullable(intArg()),
        title: nullable(stringArg()),
        comment: nullable(stringArg()),
        reviewerName: nullable(stringArg()),
      },
      resolve: async (_, args, ctx) => updateOrganizationReview(ctx.prisma, { ...args, reviewerOrgId: reviewerOrgId(ctx) }),
    })

    t.nonNull.field('deleteOrganizationReview', {
      type: 'OrganizationReview',
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => deleteOrganizationReview(ctx.prisma, id, reviewerOrgId(ctx)),
    })
  },
})
