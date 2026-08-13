import { objectType } from 'nexus'

export const RatingBreakdownItem = objectType({
  name: 'RatingBreakdownItem',
  definition(t) {
    t.nonNull.int('rating')
    t.nonNull.int('count')
  },
})

export const ReviewAggregate = objectType({
  name: 'ReviewAggregate',
  definition(t) {
    t.nonNull.float('averageRating')
    t.nonNull.int('reviewCount')
    t.nonNull.int('verifiedCount')
    t.nonNull.list.nonNull.field('breakdown', { type: 'RatingBreakdownItem' })
  },
})

export const SupplierItemReview = objectType({
  name: 'SupplierItemReview',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('supplierItemId')
    t.nonNull.int('reviewerOrgId')
    t.nonNull.int('rating')
    t.nullable.string('title')
    t.nullable.string('comment')
    t.nonNull.boolean('isVerifiedPurchase')
    t.nonNull.field('createdAt', { type: 'DateTime' })
    t.nonNull.field('updatedAt', { type: 'DateTime' })
    t.nullable.field('deletedAt', { type: 'DateTime' })
    t.nonNull.field('reviewer', {
      type: 'Organization',
      resolve: (parent, _, ctx) => ctx.prisma.organization.findUniqueOrThrow({ where: { id: parent.reviewerOrgId } }),
    })
    // Review images for Alibaba-style review display
    t.nonNull.list.nonNull.field('images', {
      type: 'SupplierItemReviewImage',
      resolve: (parent, _, ctx) =>
        ctx.prisma.supplierItemReviewImage.findMany({
          where: { supplierItemReviewId: parent.id, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        }),
    })
  },
})

export const OrganizationReview = objectType({
  name: 'OrganizationReview',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.int('organizationId')
    t.nullable.int('reviewerOrgId')
    t.nullable.int('reviewerCustomerId')
    t.nullable.string('reviewerName')
    t.nonNull.int('rating')
    t.nullable.string('title')
    t.nullable.string('comment')
    t.nonNull.boolean('isVerifiedTransaction')
    t.nonNull.field('createdAt', { type: 'DateTime' })
    t.nonNull.field('updatedAt', { type: 'DateTime' })
    t.nullable.field('deletedAt', { type: 'DateTime' })
    t.nullable.field('reviewer', {
      type: 'Organization',
      resolve: (parent, _, ctx) => {
        if (!parent.reviewerOrgId) return null
        return ctx.prisma.organization.findUnique({ where: { id: parent.reviewerOrgId } })
      },
    })
  },
})

export const SupplierItemReviewPayload = objectType({
  name: 'SupplierItemReviewPayload',
  definition(t) {
    t.nonNull.list.nonNull.field('reviews', { type: 'SupplierItemReview' })
    t.nonNull.field('aggregate', { type: 'ReviewAggregate' })
  },
})

export const OrganizationReviewPayload = objectType({
  name: 'OrganizationReviewPayload',
  definition(t) {
    t.nonNull.list.nonNull.field('reviews', { type: 'OrganizationReview' })
    t.nonNull.field('aggregate', { type: 'ReviewAggregate' })
  },
})
