// src/graphql/resolvers/image.resolver.ts
// Resolvers for image management: SupplierItemImage, SupplierItemVariantImage, SupplierItemReviewImage
import { arg, nonNull, queryField, mutationField, inputObjectType } from 'nexus'

// ─────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────

export const supplierItemImages = queryField('supplierItemImages', {
  type: 'SupplierItemImage',
  args: {
    supplierItemId: nonNull('String'),
  },
  resolve: (_root, { supplierItemId }, ctx) =>
    ctx.prisma.supplierItemImage.findMany({
      where: { supplierItemId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    }),
})

export const supplierItemVariantImages = queryField('supplierItemVariantImages', {
  type: 'SupplierItemVariantImage',
  args: {
    supplierItemVariantId: nonNull('String'),
  },
  resolve: (_root, { supplierItemVariantId }, ctx) =>
    ctx.prisma.supplierItemVariantImage.findMany({
      where: { supplierItemVariantId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    }),
})

export const supplierItemReviewImages = queryField('supplierItemReviewImages', {
  type: 'SupplierItemReviewImage',
  args: {
    supplierItemReviewId: nonNull('String'),
  },
  resolve: (_root, { supplierItemReviewId }, ctx) =>
    ctx.prisma.supplierItemReviewImage.findMany({
      where: { supplierItemReviewId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    }),
})

// ─────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────

export const createSupplierItemImage = mutationField('createSupplierItemImage', {
  type: 'SupplierItemImage',
  args: {
    input: nonNull(arg({ type: 'CreateSupplierItemImageInput' })),
  },
  resolve: async (_root, { input }, ctx) => {
    const { supplierItemId, url, sortOrder } = input
    // If no sortOrder provided, append to the end
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const max = await ctx.prisma.supplierItemImage.aggregate({
        where: { supplierItemId, deletedAt: null },
        _max: { sortOrder: true },
      })
      finalSortOrder = (max._max.sortOrder ?? 0) + 1
    }
    return ctx.prisma.supplierItemImage.create({
      data: { supplierItemId, url, sortOrder: finalSortOrder },
    })
  },
})

export const updateSupplierItemImage = mutationField('updateSupplierItemImage', {
  type: 'SupplierItemImage',
  args: {
    input: nonNull(arg({ type: 'UpdateSupplierItemImageInput' })),
  },
  resolve: (_root, { input }, ctx) => {
    const { id, ...data } = input
    return ctx.prisma.supplierItemImage.update({
      where: { id },
      data,
    })
  },
})

export const deleteSupplierItemImage = mutationField('deleteSupplierItemImage', {
  type: 'SupplierItemImage',
  args: {
    id: nonNull('Int'),
  },
  resolve: (_root, { id }, ctx) =>
    ctx.prisma.supplierItemImage.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
})

export const reorderSupplierItemImages = mutationField('reorderSupplierItemImages', {
  type: 'SupplierItemImage',
  args: {
    input: nonNull(arg({ type: 'ReorderImagesInput' })),
  },
  resolve: async (_root, { input }, ctx) => {
    const { ids, sortOrders } = input
    const updates = ids.map((id: number, index: number) =>
      ctx.prisma.supplierItemImage.update({
        where: { id },
        data: { sortOrder: sortOrders[index] },
      })
    )
    await Promise.all(updates)
    return ctx.prisma.supplierItemImage.findUnique({ where: { id: ids[0] } })
  },
})

export const createSupplierItemVariantImage = mutationField('createSupplierItemVariantImage', {
  type: 'SupplierItemVariantImage',
  args: {
    input: nonNull(arg({ type: 'CreateSupplierItemVariantImageInput' })),
  },
  resolve: async (_root, { input }, ctx) => {
    const { supplierItemVariantId, url, sortOrder } = input
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const max = await ctx.prisma.supplierItemVariantImage.aggregate({
        where: { supplierItemVariantId, deletedAt: null },
        _max: { sortOrder: true },
      })
      finalSortOrder = (max._max.sortOrder ?? 0) + 1
    }
    return ctx.prisma.supplierItemVariantImage.create({
      data: { supplierItemVariantId, url, sortOrder: finalSortOrder },
    })
  },
})

export const updateSupplierItemVariantImage = mutationField('updateSupplierItemVariantImage', {
  type: 'SupplierItemVariantImage',
  args: {
    input: nonNull(arg({ type: 'UpdateSupplierItemVariantImageInput' })),
  },
  resolve: (_root, { input }, ctx) => {
    const { id, ...data } = input
    return ctx.prisma.supplierItemVariantImage.update({
      where: { id },
      data,
    })
  },
})

export const deleteSupplierItemVariantImage = mutationField('deleteSupplierItemVariantImage', {
  type: 'SupplierItemVariantImage',
  args: {
    id: nonNull('Int'),
  },
  resolve: (_root, { id }, ctx) =>
    ctx.prisma.supplierItemVariantImage.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
})

export const reorderSupplierItemVariantImages = mutationField('reorderSupplierItemVariantImages', {
  type: 'SupplierItemVariantImage',
  args: {
    input: nonNull(arg({ type: 'ReorderImagesInput' })),
  },
  resolve: async (_root, { input }, ctx) => {
    const { ids, sortOrders } = input
    const updates = ids.map((id: number, index: number) =>
      ctx.prisma.supplierItemVariantImage.update({
        where: { id },
        data: { sortOrder: sortOrders[index] },
      })
    )
    await Promise.all(updates)
    return ctx.prisma.supplierItemVariantImage.findUnique({ where: { id: ids[0] } })
  },
})

export const createSupplierItemReviewImage = mutationField('createSupplierItemReviewImage', {
  type: 'SupplierItemReviewImage',
  args: {
    input: nonNull(arg({ type: 'CreateSupplierItemReviewImageInput' })),
  },
  resolve: async (_root, { input }, ctx) => {
    const { supplierItemReviewId, url, sortOrder } = input
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const max = await ctx.prisma.supplierItemReviewImage.aggregate({
        where: { supplierItemReviewId, deletedAt: null },
        _max: { sortOrder: true },
      })
      finalSortOrder = (max._max.sortOrder ?? 0) + 1
    }
    return ctx.prisma.supplierItemReviewImage.create({
      data: { supplierItemReviewId, url, sortOrder: finalSortOrder },
    })
  },
})

export const deleteSupplierItemReviewImage = mutationField('deleteSupplierItemReviewImage', {
  type: 'SupplierItemReviewImage',
  args: {
    id: nonNull('Int'),
  },
  resolve: (_root, { id }, ctx) =>
    ctx.prisma.supplierItemReviewImage.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
})