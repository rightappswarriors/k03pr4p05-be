// Variant read operations.
import { extendType, nonNull, nullable, stringArg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js'
import { requireSupplierItemScope, requireSupplierVariantGroupScope, requireSupplierVariantScope } from '../../../lib/supplierScope.js'

export const SupplierItemVariantQuery = extendType({
  type: 'Query',
  definition(t) {

    // All variants for a parent item.
    t.nonNull.list.nonNull.field('supplierItemVariants', {
      type: 'SupplierItemVariant',
      args: { supplierItemId: nonNull(stringArg()) },
      resolve: async (_, { supplierItemId }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierProducts.view(ctx)
        await requireSupplierItemScope(ctx, supplierItemId)
        return ctx.prisma.supplierItemVariant.findMany({
          where: { supplierItemId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { variantValues: { include: { option: true } } },
        })
      },
    })

    // Single variant by id.
    t.nullable.field('supplierItemVariant', {
      type: 'SupplierItemVariant',
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierProducts.view(ctx)
        await requireSupplierVariantScope(ctx, id)
        return ctx.prisma.supplierItemVariant.findUnique({
          where: { id },
          include: { variantValues: { include: { option: true } } },
        })
      },
    })

    // All variant groups (dimensions) for a parent item.
    t.nonNull.list.nonNull.field('variantGroups', {
      type: 'SupplierItemVariantGroup',
      args: { supplierItemId: nonNull(stringArg()) },
      resolve: async (_, { supplierItemId }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierProducts.view(ctx)
        await requireSupplierItemScope(ctx, supplierItemId)
        return ctx.prisma.supplierItemVariantGroup.findMany({
          where: { supplierItemId },
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        })
      },
    })

    // All options for a specific variant group.
    t.nonNull.list.nonNull.field('variantOptions', {
      type: 'SupplierItemVariantOption',
      args: { variantGroupId: nonNull(stringArg()) },
      resolve: async (_, { variantGroupId }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.supplierProducts.view(ctx)
        await requireSupplierVariantGroupScope(ctx, variantGroupId)
        return ctx.prisma.supplierItemVariantOption.findMany({
          where: { variantGroupId },
          orderBy: { sortOrder: 'asc' },
        })
      },
    })
  },
})
