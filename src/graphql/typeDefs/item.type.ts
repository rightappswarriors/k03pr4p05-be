import { objectType } from 'nexus'

export const Item = objectType({
    name: 'Item',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('name')
        t.nullable.string('image')
        t.nullable.string('description')
        t.nullable.string('barcode')
        t.nullable.int('categoryId')
        t.nullable.string('skuNumber')
        t.nullable.string('itemCode')
        t.nonNull.boolean('vatExempt')
        t.nonNull.boolean('ServiceCharge')
        t.nonNull.boolean('assembly')
        t.nullable.string('brand')
        t.nullable.field('category', {
            type: 'Category',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the category
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).category();
            }
        })
        t.nonNull.list.nonNull.field('color', {
            type: 'Color',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the colors
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).color();
            }
        })
        t.nonNull.list.nonNull.field('InventoryItems', {
            type: 'InventoryItems',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the inventory items
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).InventoryItems();
            }
        })
        t.nonNull.list.nonNull.field('cartItems', {
            type: 'CartItem',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the cart items
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).cartItems();
            }
        })

        t.nonNull.list.nonNull.field('media', {
            type: 'Media',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the cart items
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).media();
            }
        })
        t.nullable.int('brandId')
        t.nullable.field('brandDetails', {
            type: 'Brand',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the brandDetails
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).brandDetails();
            }
        })
        t.nonNull.list.nonNull.field("purchaseUnit", {
            type: 'ItemUnit',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the category
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).purchaseUnit();
            }
        })
        t.nonNull.list.nonNull.field('searchIndex', {
            type: 'OutletItemSearchIndex',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the category
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).searchIndex();
            }
        })
    }
})


export const ItemUnit = objectType({
    name: "ItemUnit",
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('unitName')
        t.nullable.string('description')
        t.nonNull.list.nonNull.field('Item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the category
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).item();
            }
        })
    },
})

export const OutletItemSearchIndex = objectType({
    name: "OutletItemSearchIndex",
    definition(t) {
        t.nonNull.int("id")
        t.nonNull.int("outletId")
        t.nonNull.int("itemId")
        t.nonNull.int("inventoryItemId")
        t.nonNull.int("quantity")
        t.nonNull.float("price")
        t.nonNull.float("outletLatitude")
        t.nonNull.float("outletLongitude")

        // ── Relations ─────────────────────────────────────────────────────────

        t.nonNull.field("outlet", {
            type: "Outlet",
            resolve: async (parent, _, ctx) => {
                const row = await ctx.prisma.outletItemSearchIndex.findUnique({
                    where: { id: parent.id },
                    include: { outlet: true },
                })
                return row!.outlet
            },
        })

        t.nonNull.field("item", {
            type: "Item",
            resolve: async (parent, _, ctx) => {
                const row = await ctx.prisma.outletItemSearchIndex.findUnique({
                    where: { id: parent.id },
                    include: { item: true },
                })
                return row!.item
            },
        })

        t.nonNull.field("inventoryItem", {
            type: "InventoryItems",
            resolve: async (parent, _, ctx) => {
                const row = await ctx.prisma.outletItemSearchIndex.findUnique({
                    where: { id: parent.id },
                    include: { inventoryItem: true },
                })
                return row!.inventoryItem
            },
        })
    },
})
/*
export const EkumpraCOrderItem = objectType({
    name: "EkumpraCOrderItem",
    definition(t) {
        t.nonNull.int("id")
        t.nonNull.int("orderId")
        t.nonNull.int("inventoryItemId")
        t.nonNull.int("itemId")
        t.nonNull.int("quantity")
        t.nonNull.float("priceSnapshot")
        t.nonNull.float("subtotal")

        // ── Relations ─────────────────────────────────────────────────────────

        t.nonNull.field("order", {
            type: "EkumpraCOrder",
            resolve: async (parent, _, ctx) => {
                const row = await ctx.prisma.ekumpraCOrderItem.findUnique({
                    where: { id: parent.id },
                    include: { order: true },
                })
                return row!.order
            },
        })

        t.nonNull.field("inventoryItem", {
            type: "InventoryItems",
            resolve: async (parent, _, ctx) => {
                const row = await ctx.prisma.ekumpraCOrderItem.findUnique({
                    where: { id: parent.id },
                    include: { inventoryItem: true },
                })
                return row!.inventoryItem
            },
        })

        t.nonNull.field("item", {
            type: "Item",
            resolve: async (parent, _, ctx) => {
                const row = await ctx.prisma.ekumpraCOrderItem.findUnique({
                    where: { id: parent.id },
                    include: { item: true },
                })
                return row!.item
            },
        })
    },
}) */