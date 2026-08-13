// Variant write operations — groups, options, variants, and generator.
import { extendType, nonNull, nullable, stringArg, intArg, floatArg, booleanArg, list, arg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'

// ─── helpers ──────────────────────────────────────────────────────────────────

// Build a human-readable variant name from its option values.
function buildVariantName(optionValues: string[]): string {
  return optionValues.join(' / ')
}

// Cartesian product of option-id arrays — powers generateVariants.
function cartesian(arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap((existing) => arr.map((item) => [...existing, item])),
    [[]],
  )
}

// ─── resolver ─────────────────────────────────────────────────────────────────

export const SupplierItemVariantMutation = extendType({
  type: 'Mutation',
  definition(t) {

    // ── Variant Groups ─────────────────────────────────────────────────────

    t.nonNull.field('createVariantGroup', {
      type: 'SupplierItemVariantGroup',
      args: {
        supplierItemId: nonNull(stringArg()),
        name: nonNull(stringArg()),
        sortOrder: nullable(intArg()),
        options: nullable(list(nonNull(arg({ type: 'VariantOptionInput' })))),
      },
      resolve: async (_, { supplierItemId, name, sortOrder, options }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.supplierItemVariantGroup.create({
          data: {
            supplierItemId,
            name,
            sortOrder: sortOrder ?? 0,
            options: options?.length
              ? {
                  create: options.map((o: any, i: number) => ({
                    value: o.value,
                    colorHex: o.colorHex ?? null,
                    image: o.image ?? null,
                    sortOrder: o.sortOrder ?? i,
                  })),
                }
              : undefined,
          },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        })
      },
    })

    t.nonNull.field('updateVariantGroup', {
      type: 'SupplierItemVariantGroup',
      args: {
        id: nonNull(stringArg()),
        name: nullable(stringArg()),
        sortOrder: nullable(intArg()),
      },
      resolve: (_, { id, name, sortOrder }, ctx) => {
        requireAuth(ctx)
        const data: any = {}
        if (name != null) data.name = name
        if (sortOrder != null) data.sortOrder = sortOrder
        return ctx.prisma.supplierItemVariantGroup.update({
          where: { id },
          data,
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        })
      },
    })

    t.nonNull.boolean('deleteVariantGroup', {
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        // Cascade in DB handles options and variant-values.
        await ctx.prisma.supplierItemVariantGroup.delete({ where: { id } })
        return true
      },
    })

    // ── Variant Options ────────────────────────────────────────────────────

    t.nonNull.field('createVariantOption', {
      type: 'SupplierItemVariantOption',
      args: {
        variantGroupId: nonNull(stringArg()),
        value: nonNull(stringArg()),
        colorHex: nullable(stringArg()),
        image: nullable(stringArg()),
        sortOrder: nullable(intArg()),
      },
      resolve: (_, { variantGroupId, value, colorHex, image, sortOrder }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.supplierItemVariantOption.create({
          data: { variantGroupId, value, colorHex, image, sortOrder: sortOrder ?? 0 },
        })
      },
    })

    t.nonNull.field('updateVariantOption', {
      type: 'SupplierItemVariantOption',
      args: {
        id: nonNull(stringArg()),
        value: nullable(stringArg()),
        colorHex: nullable(stringArg()),
        image: nullable(stringArg()),
        sortOrder: nullable(intArg()),
      },
      resolve: (_, { id, ...updates }, ctx) => {
        requireAuth(ctx)
        const data: any = {}
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) data[k] = v
        }
        return ctx.prisma.supplierItemVariantOption.update({ where: { id }, data })
      },
    })

    t.nonNull.boolean('deleteVariantOption', {
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        await ctx.prisma.supplierItemVariantOption.delete({ where: { id } })
        return true
      },
    })

    // ── Single Variant CRUD ────────────────────────────────────────────────

    t.nonNull.field('createVariant', {
      type: 'SupplierItemVariant',
      args: { input: nonNull(arg({ type: 'CreateVariantInput' })) },
      resolve: async (_, { input }, ctx) => {
        requireAuth(ctx)
        const { supplierItemId, optionIds, availableQty, cost, isDefault, ...rest } = input as any
        const variant = await ctx.prisma.supplierItemVariant.create({
          data: {
            supplierItemId,
            availableQty: availableQty ?? 0,
            cost: cost ?? 0,
            isDefault: isDefault ?? false,
            ...rest,
            variantValues: {
              create: (optionIds as string[]).map((optionId: string) => ({ optionId })),
            },
          },
          include: { variantValues: { include: { option: true } } },
        })
        return variant
      },
    })

    t.nonNull.field('updateVariant', {
      type: 'SupplierItemVariant',
      args: { input: nonNull(arg({ type: 'UpdateVariantInput' })) },
      resolve: (_, { input }, ctx) => {
        requireAuth(ctx)
        const { id, ...updates } = input as any
        const data: any = {}
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) data[k] = v
        }
        return ctx.prisma.supplierItemVariant.update({
          where: { id },
          data,
          include: { variantValues: { include: { option: true } } },
        })
      },
    })

    t.nonNull.boolean('deleteVariant', {
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        // Soft delete — keep for history.
        await ctx.prisma.supplierItemVariant.update({
          where: { id },
          data: { deletedAt: new Date(), isActive: false },
        })
        return true
      },
    })

    // ── Variant Generator ──────────────────────────────────────────────────
    //
    // Given the existing groups/options on a supplierItem, this generates
    // the full Cartesian product of variants. Already-existing combinations
    // (matched by sorted optionId set) are skipped to avoid duplicates.

    t.nonNull.field('generateVariants', {
      type: 'GenerateVariantsResult',
      args: {
        supplierItemId: nonNull(stringArg()),
        basePrice: nonNull(floatArg()),
        baseCost: nullable(floatArg()),
      },
      resolve: async (_, { supplierItemId, basePrice, baseCost }, ctx) => {
        requireAuth(ctx)

        const groups = await ctx.prisma.supplierItemVariantGroup.findMany({
          where: { supplierItemId },
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        })

        if (groups.length === 0) {
          return { created: 0, skipped: 0, variants: [] }
        }

        // Build Cartesian product of option id arrays.
        const optionIdArrays = groups.map((g: any) => g.options.map((o: any) => o.id))
        const combinations = cartesian(optionIdArrays)

        // Fetch existing variants with their option sets for dedup.
        const existing = await ctx.prisma.supplierItemVariant.findMany({
          where: { supplierItemId, deletedAt: null },
          include: { variantValues: true },
        })
        const existingKeys = new Set(
          existing.map((v: any) =>
            v.variantValues
              .map((vv: any) => vv.optionId)
              .sort()
              .join(','),
          ),
        )

        const created: any[] = []
        let skipped = 0

        for (const combo of combinations) {
          const key = [...combo].sort().join(',')
          if (existingKeys.has(key)) { skipped++; continue }

          // Build human-readable name from option values.
          const optionValues = combo.map((optId) => {
            for (const g of groups) {
              const found = (g as any).options.find((o: any) => o.id === optId)
              if (found) return found.value
            }
            return optId
          })

          const variant = await ctx.prisma.supplierItemVariant.create({
            data: {
              supplierItemId,
              name: buildVariantName(optionValues),
              price: basePrice,
              cost: baseCost ?? 0,
              isDefault: existing.length === 0 && created.length === 0,
              variantValues: { create: combo.map((optionId) => ({ optionId })) },
            },
            include: { variantValues: { include: { option: true } } },
          })
          created.push(variant)
        }

        return { created: created.length, skipped, variants: created }
      },
    })
  },
})
