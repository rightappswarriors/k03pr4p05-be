import { arg, list, nonNull, objectType, inputObjectType, queryField, mutationField } from 'nexus'

// ─────────────────────────────────────────────────────────────
// OUTPUT TYPES
// ─────────────────────────────────────────────────────────────

export const PricingKPIs = objectType({
    name: 'PricingKPIs',
    definition(t) {
        t.nonNull.int('activePriceCount')
        t.nonNull.float('averageSellingPrice')
        t.nonNull.float('averageMargin')
        t.nonNull.float('highestMargin')
        t.nonNull.float('lowestMargin')
        t.nonNull.int('productsOnPromotion')
        t.nonNull.int('scheduledPriceChanges')
        t.nonNull.int('priceUpdatesThisMonth')
    },
})

export const PricingListItem = objectType({
    name: 'PricingListItem',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('name')
        t.nullable.string('image')
        t.nullable.string('sku')
        t.nullable.string('categoryName')
        t.nullable.int('categoryId')
        t.nonNull.float('currentCost')
        t.nonNull.float('sellingPrice')
        t.nonNull.float('margin')
        t.nonNull.float('markup')
        t.nonNull.int('priceTierCount')
        t.nonNull.dateTime('updatedAt')
        t.nonNull.boolean('isActive')
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent: { id: string }, _: unknown, ctx: any) =>
                ctx.prisma.supplierItem.findUniqueOrThrow({ where: { id: parent.id } }),
        })
    },
})

export const PricingListResult = objectType({
    name: 'PricingListResult',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'PricingListItem' })
        t.nonNull.int('total')
        t.nonNull.int('page')
        t.nonNull.int('pageSize')
    },
})

export const PricingDetail = objectType({
    name: 'PricingDetail',
    definition(t) {
        t.nonNull.field('supplierItem', { type: 'SupplierItem' })
        t.nonNull.float('margin')
        t.nonNull.float('markup')
        t.nonNull.float('profitPerUnit')
    },
})

export const PricingAnalytics = objectType({
    name: 'PricingAnalytics',
    definition(t) {
        t.nonNull.list.nonNull.field('priceTrend', { type: 'SupplierItemPriceHistory' })
        t.nonNull.float('estimatedRevenue')
        t.nonNull.float('estimatedProfit')
        t.nonNull.float('averageSellingPrice')
        t.nonNull.float('highestPrice')
        t.nonNull.float('lowestPrice')
        t.nonNull.float('averageMargin')
        t.nonNull.int('priceChangeCount')
    },
})

// ─────────────────────────────────────────────────────────────
// INPUT TYPES
// ─────────────────────────────────────────────────────────────

export const PricingListFilterInput = inputObjectType({
    name: 'PricingListFilterInput',
    definition(t) {
        t.nullable.string('search')
        t.nullable.int('categoryId')
        t.nullable.string('brand')
        t.nullable.float('minPrice')
        t.nullable.float('maxPrice')
        t.nullable.float('minMargin')
        t.nullable.float('maxMargin')
        t.nullable.dateTime('startDate')
        t.nullable.dateTime('endDate')
    },
})

export const BulkPriceUpdateItemInput = inputObjectType({
    name: 'BulkPriceUpdateItemInput',
    definition(t) {
        t.nonNull.string('supplierItemId')
        t.nonNull.float('price')
    },
})

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function computeMargin(sellingPrice: number, cost: number): number {
    if (!sellingPrice) return 0
    return ((sellingPrice - cost) / sellingPrice) * 100
}

function computeMarkup(sellingPrice: number, cost: number): number {
    if (!cost) return 0
    return ((sellingPrice - cost) / cost) * 100
}

// ─────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────

export const pricingDashboard = queryField('pricingDashboard', {
    type: 'PricingKPIs',
    args: {
        catalogId: 'String',
    },
    resolve: async (_root, { catalogId }, ctx) => {
        const items = await ctx.prisma.supplierItem.findMany({
            where: { catalogId, deletedAt: null, isActive: true },
        })

        const margins = items.map((i: { unitPrice: number; currentCost: number }) => computeMargin(i.unitPrice, i.currentCost))
        const activeCount = items.length
        const avgPrice = activeCount
            ? items.reduce((sum: number, i: { unitPrice: number }) => sum + i.unitPrice, 0) / activeCount
            : 0
        const avgMargin = margins.length ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length : 0
        const highestMargin = margins.length ? Math.max(...margins) : 0
        const lowestMargin = margins.length ? Math.min(...margins) : 0

        const promotionsCount = await ctx.prisma.supplierScheduledPrice.count({
            where: {
                deletedAt: null,
                status: 'ACTIVE',
                supplierItem: { catalogId, deletedAt: null },
            },
        })

        const scheduledCount = await ctx.prisma.supplierScheduledPrice.count({
            where: {
                deletedAt: null,
                status: 'PENDING',
                supplierItem: { catalogId, deletedAt: null },
            },
        })

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const priceUpdatesThisMonth = await ctx.prisma.supplierItemPriceHistory.count({
            where: {
                effectiveAt: { gte: startOfMonth },
                supplierItem: { catalogId, deletedAt: null },
            },
        })

        return {
            activePriceCount: activeCount,
            averageSellingPrice: avgPrice,
            averageMargin: avgMargin,
            highestMargin,
            lowestMargin,
            productsOnPromotion: promotionsCount,
            scheduledPriceChanges: scheduledCount,
            priceUpdatesThisMonth,
        }
    },
})

export const pricingList = queryField('pricingList', {
    type: 'PricingListResult',
    args: {
        catalogId: 'String',
        page: 'Int',
        pageSize: 'Int',
        filter: 'PricingListFilterInput',
    },
    resolve: async (_root, { catalogId, page, pageSize, filter }, ctx) => {
        const take = pageSize ?? 20
        const skip = ((page ?? 1) - 1) * take

        const where: any = { catalogId, deletedAt: null }

        if (filter?.search) {
            where.OR = [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { sku: { contains: filter.search, mode: 'insensitive' } },
            ]
        }
        if (filter?.minPrice != null || filter?.maxPrice != null) {
            where.unitPrice = {
                ...(filter.minPrice != null ? { gte: filter.minPrice } : {}),
                ...(filter.maxPrice != null ? { lte: filter.maxPrice } : {}),
            }
        }
        if (filter?.startDate || filter?.endDate) {
            where.updatedAt = {
                ...(filter.startDate ? { gte: filter.startDate } : {}),
                ...(filter.endDate ? { lte: filter.endDate } : {}),
            }
        }

        const [rows, total] = await Promise.all([
            ctx.prisma.supplierItem.findMany({
                where,
                include: { priceTiers: true },
                orderBy: { updatedAt: 'desc' },
                skip,
                take,
            }),
            ctx.prisma.supplierItem.count({ where }),
        ])

        let items = rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            image: r.image,
            sku: r.sku,
            categoryName: null as string | null,
            categoryId: null as number | null,
            currentCost: r.currentCost,
            sellingPrice: r.unitPrice,
            margin: computeMargin(r.unitPrice, r.currentCost),
            markup: computeMarkup(r.unitPrice, r.currentCost),
            priceTierCount: r.priceTiers.length,
            updatedAt: r.updatedAt,
            isActive: r.isActive,
        }))

        if (filter?.minMargin != null) {
            items = items.filter((i: { margin: number }) => i.margin >= filter.minMargin!)
        }
        if (filter?.maxMargin != null) {
            items = items.filter((i: { margin: number }) => i.margin <= filter.maxMargin!)
        }

        return { items, total, page: page ?? 1, pageSize: take }
    },
})

export const pricingDetail = queryField('pricingDetail', {
    type: 'PricingDetail',
    args: {
        supplierItemId: 'String',
    },
    resolve: async (_root, { supplierItemId }, ctx) => {
        const item = await ctx.prisma.supplierItem.findUniqueOrThrow({
            where: { id: supplierItemId! },
            include: { priceTiers: true },
        })
        const margin = computeMargin(item.unitPrice, item.currentCost)
        const markup = computeMarkup(item.unitPrice, item.currentCost)
        return {
            supplierItem: item,
            margin,
            markup,
            profitPerUnit: item.unitPrice - item.currentCost,
        }
    },
})

export const pricingAnalytics = queryField('pricingAnalytics', {
    type: 'PricingAnalytics',
    args: {
        supplierItemId: 'String',
    },
    resolve: async (_root, { supplierItemId }, ctx) => {
        const priceTrend = await ctx.prisma.supplierItemPriceHistory.findMany({
            where: { supplierItemId: supplierItemId! },
            orderBy: { effectiveAt: 'asc' },
        })

        const item = await ctx.prisma.supplierItem.findUniqueOrThrow({
            where: { id: supplierItemId! },
        })

        const prices = priceTrend.map((p: { newPrice: number }) => p.newPrice)
        const highestPrice = prices.length ? Math.max(...prices) : item.unitPrice
        const lowestPrice = prices.length ? Math.min(...prices) : item.unitPrice
        const avgPrice = prices.length
            ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length
            : item.unitPrice

        const margin = computeMargin(item.unitPrice, item.currentCost)
        const estimatedRevenue = item.unitPrice * item.availableQty
        const estimatedProfit = (item.unitPrice - item.currentCost) * item.availableQty

        return {
            priceTrend,
            estimatedRevenue,
            estimatedProfit,
            averageSellingPrice: avgPrice,
            highestPrice,
            lowestPrice,
            averageMargin: margin,
            priceChangeCount: priceTrend.length,
        }
    },
})

export const supplierItemPriceHistoryList = queryField('supplierItemPriceHistoryList', {
    type: list(nonNull('SupplierItemPriceHistory')),
    args: {
        supplierItemId: 'String',
    },
    resolve: (_root, { supplierItemId }, ctx) =>
        ctx.prisma.supplierItemPriceHistory.findMany({
            where: { supplierItemId: supplierItemId! },
            orderBy: { effectiveAt: 'desc' },
        }),
})

export const scheduledPricesList = queryField('scheduledPricesList', {
    type: list(nonNull('SupplierScheduledPrice')),
    args: {
        supplierItemId: 'String',
    },
    resolve: (_root, { supplierItemId }, ctx) =>
        ctx.prisma.supplierScheduledPrice.findMany({
            where: { supplierItemId: supplierItemId!, deletedAt: null },
            orderBy: { effectiveAt: 'desc' },
        }),
})

// ─────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────

export const updatePrice = mutationField('updatePrice', {
    type: 'SupplierItem',
    args: {
        supplierItemId: 'String',
        price: 'Float',
        vatRate: 'Float',
        moq: 'Int',
        reason: 'String',
        changedById: 'Int',
        priceTiers: list(arg({ type: 'PriceTierInput' })),
        effectiveAt: 'DateTime',
    },
    resolve: async (_root, { supplierItemId, price, vatRate, moq, reason, changedById, priceTiers, effectiveAt }, ctx) => {
        const existing = await ctx.prisma.supplierItem.findUniqueOrThrow({
            where: { id: supplierItemId! },
            include: { priceTiers: true },
        })

        const effectiveDate = effectiveAt ? new Date(effectiveAt) : new Date()

        if (price != null && price !== existing.unitPrice) {
            await ctx.prisma.supplierItemPriceHistory.create({
                data: {
                    supplierItemId: supplierItemId!,
                    oldPrice: existing.unitPrice,
                    newPrice: price,
                    changedById,
                    reason: reason ?? 'manual update',
                    effectiveAt: effectiveDate,
                },
            })
        }

        if (priceTiers !== undefined) {
            await ctx.prisma.priceTier.deleteMany({ where: { supplierItemId: supplierItemId! } })
            if (priceTiers.length) {
                await ctx.prisma.priceTier.createMany({
                    data: priceTiers.map((tier: { minQty: number; price: number }) => ({
                        supplierItemId: supplierItemId!,
                        minQty: tier.minQty,
                        price: tier.price,
                    })),
                })
            }
        }

        return ctx.prisma.supplierItem.update({
            where: { id: supplierItemId! },
            data: {
                ...(price != null ? { unitPrice: price } : {}),
                ...(vatRate != null ? { vatRate } : {}),
                ...(moq != null ? { moq } : {}),
            },
            include: { priceTiers: true },
        })
    },
})

export const bulkUpdatePrices = mutationField('bulkUpdatePrices', {
    type: list(nonNull('SupplierItem')),
    args: {
        items: nonNull(list(nonNull(arg({ type: 'BulkPriceUpdateItemInput' })))),
        reason: 'String',
        changedById: 'Int',
    },
    resolve: async (_root, { items, reason, changedById }, ctx) => {
        const results: Array<any> = []
        for (const { supplierItemId, price } of items!) {
            const existing = await ctx.prisma.supplierItem.findUniqueOrThrow({
                where: { id: supplierItemId },
            })
            if (price !== existing.unitPrice) {
                await ctx.prisma.supplierItemPriceHistory.create({
                    data: {
                        supplierItemId,
                        oldPrice: existing.unitPrice,
                        newPrice: price,
                        changedById,
                        reason: reason ?? 'bulk update',
                    },
                })
            }
            const updated = await ctx.prisma.supplierItem.update({
                where: { id: supplierItemId },
                data: { unitPrice: price },
            })
            results.push(updated)
        }
        return results
    },
})

export const createScheduledPrice = mutationField('createScheduledPrice', {
    type: 'SupplierScheduledPrice',
    args: {
        supplierItemId: 'String',
        price: 'Float',
        effectiveAt: 'DateTime',
        expiresAt: 'DateTime',
        createdById: 'Int',
        reason: 'String',
    },
    resolve: (_root, { supplierItemId, price, effectiveAt, expiresAt, createdById }, ctx) =>
        ctx.prisma.supplierScheduledPrice.create({
            data: {
                supplierItemId: supplierItemId!,
                price: price!,
                effectiveAt: effectiveAt!,
                expiresAt,
                createdById,
                status: 'PENDING',
            },
        }),
})

export const editScheduledPrice = mutationField('editScheduledPrice', {
    type: 'SupplierScheduledPrice',
    args: {
        id: 'String',
        price: 'Float',
        effectiveAt: 'DateTime',
        expiresAt: 'DateTime',
        reason: 'String',
    },
    resolve: (_root, { id, price, effectiveAt, expiresAt }, ctx) =>
        ctx.prisma.supplierScheduledPrice.update({
            where: { id: id! },
            data: {
                ...(price != null ? { price } : {}),
                ...(effectiveAt != null ? { effectiveAt } : {}),
                ...(expiresAt !== undefined ? { expiresAt } : {}),
            },
        }),
})

export const cancelScheduledPrice = mutationField('cancelScheduledPrice', {
    type: 'SupplierScheduledPrice',
    args: {
        id: 'String',
    },
    resolve: (_root, { id }, ctx) =>
        ctx.prisma.supplierScheduledPrice.update({
            where: { id: id! },
            data: { status: 'CANCELLED' },
        }),
})

export const deleteScheduledPrice = mutationField('deleteScheduledPrice', {
    type: 'SupplierScheduledPrice',
    args: {
        id: 'String',
    },
    resolve: (_root, { id }, ctx) =>
        ctx.prisma.supplierScheduledPrice.update({
            where: { id: id! },
            data: { deletedAt: new Date() },
        }),
})
