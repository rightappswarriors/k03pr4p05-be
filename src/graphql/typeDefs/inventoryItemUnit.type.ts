// graphql/typeDefs/inventoryItemUnit.type.ts

import {
  objectType, inputObjectType, extendType,
  nonNull, nullable, intArg, floatArg, stringArg, booleanArg, list, arg,
} from "nexus";

// ─── Object type ──────────────────────────────────────────────────────────────

export const InventoryItemUnitType = objectType({
  name: "InventoryItemUnit",
  definition(t) {
    t.nonNull.int("id")
    t.nonNull.int("inventoryItemId")
    t.nonNull.string("unitName")       // "sack", "kilo", "cup"
    t.nonNull.string("unitLabel")      // "25kg Sack", "Per Kilo", "Per Cup"
    t.nonNull.float("price")
    t.nonNull.float("quantity")
    t.nonNull.float("conversionFactor") // 1 sack = 25 kg
    t.nonNull.string("baseUnit")        // "kg", "piece", "liter"
    t.nullable.string("barcode")
    t.nonNull.boolean("isDefault")
    t.nonNull.boolean("isActive")
    t.nullable.float("minOrderQty")
    t.nullable.float("maxOrderQty")
    t.nullable.float("reorderPoint")

    t.nonNull.field("inventoryItem", {
      type: "InventoryItems",
      resolve: async (parent, _, ctx) => {
        const row = await ctx.prisma.inventoryItemUnit.findUnique({
          where: { id: parent.id },
          include: { inventoryItem: true },
        })
        return row!.inventoryItem
      },
    })
  },
})

// ─── Input types ──────────────────────────────────────────────────────────────

export const CreateInventoryItemUnitInput = inputObjectType({
  name: "CreateInventoryItemUnitInput",
  definition(t) {
    t.nonNull.string("unitName")        // "sack"
    t.nonNull.string("unitLabel")       // "25kg Sack"
    t.nonNull.float("price")            // ₱1200
    t.nonNull.float("quantity")         // 40 sacks in stock
    t.nonNull.float("conversionFactor") // 25 (1 sack = 25 kg)
    t.nonNull.string("baseUnit")        // "kg"
    t.nullable.string("barcode")
    t.nullable.boolean("isDefault")
    t.nullable.float("minOrderQty")
    t.nullable.float("maxOrderQty")
    t.nullable.float("reorderPoint")
  },
})

export const UpdateInventoryItemUnitInput = inputObjectType({
  name: "UpdateInventoryItemUnitInput",
  definition(t) {
    t.nullable.string("unitLabel")
    t.nullable.float("price")
    t.nullable.float("quantity")
    t.nullable.float("conversionFactor")
    t.nullable.string("baseUnit")
    t.nullable.string("barcode")
    t.nullable.boolean("isDefault")
    t.nullable.boolean("isActive")
    t.nullable.float("minOrderQty")
    t.nullable.float("maxOrderQty")
    t.nullable.float("reorderPoint")
  },
})

// ─── Queries ──────────────────────────────────────────────────────────────────

export const InventoryItemUnitQuery = extendType({
  type: "Query",
  definition(t) {
    // Get all units for a specific InventoryItems row
    t.nonNull.list.nonNull.field("inventoryItemUnits", {
      type: "InventoryItemUnit",
      args: { inventoryItemId: nonNull(intArg()) },
      resolve: (_root, { inventoryItemId }, ctx) =>
        ctx.prisma.inventoryItemUnit.findMany({
          where: { inventoryItemId, isActive: true },
          orderBy: [{ isDefault: "desc" }, { price: "asc" }],
        }),
    })
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const InventoryItemUnitMutation = extendType({
  type: "Mutation",
  definition(t) {

    // Add one or more selling units to an inventory item
    // e.g. add "sack", "kilo", "cup" to Rice
    t.nonNull.list.nonNull.field("addInventoryItemUnits", {
      type: "InventoryItemUnit",
      args: {
        inventoryItemId: nonNull(intArg()),
        units: nonNull(list(nonNull(arg({ type: "CreateInventoryItemUnitInput" })))),
      },
      resolve: async (_root, { inventoryItemId, units }, ctx) => {
        // If any unit is marked default, unset existing defaults first
        const hasNewDefault = units.some((u) => u.isDefault)
        if (hasNewDefault) {
          await ctx.prisma.inventoryItemUnit.updateMany({
            where: { inventoryItemId, isDefault: true },
            data: { isDefault: false },
          })
        }

        return ctx.prisma.$transaction(
          units.map((u) =>
            ctx.prisma.inventoryItemUnit.create({
              data: {
                inventoryItemId,
                unitName:          u.unitName,
                unitLabel:         u.unitLabel,
                price:             u.price,
                quantity:          u.quantity,
                conversionFactor:  u.conversionFactor,
                baseUnit:          u.baseUnit,
                barcode:           u.barcode    ?? null,
                isDefault:         u.isDefault  ?? false,
                minOrderQty:       u.minOrderQty ?? null,
                maxOrderQty:       u.maxOrderQty ?? null,
                reorderPoint:      u.reorderPoint ?? null,
              },
            })
          )
        )
      },
    })

    // Update a single unit (change price, restock, toggle active)
    t.nonNull.field("updateInventoryItemUnit", {
      type: "InventoryItemUnit",
      args: {
        id:   nonNull(intArg()),
        data: nonNull(arg({ type: "UpdateInventoryItemUnitInput" })),
      },
      resolve: async (_root, { id, data }, ctx) => {
        // If setting as default, unset others on same inventoryItem first
        if (data.isDefault) {
          const existing = await ctx.prisma.inventoryItemUnit.findUnique({
            where: { id },
            select: { inventoryItemId: true },
          })
          if (existing) {
            await ctx.prisma.inventoryItemUnit.updateMany({
              where: { inventoryItemId: existing.inventoryItemId, isDefault: true },
              data: { isDefault: false },
            })
          }
        }

        return ctx.prisma.inventoryItemUnit.update({
          where: { id },
          data: {
            ...(data.unitLabel        != null && { unitLabel:        data.unitLabel }),
            ...(data.price            != null && { price:            data.price }),
            ...(data.quantity         != null && { quantity:         data.quantity }),
            ...(data.conversionFactor != null && { conversionFactor: data.conversionFactor }),
            ...(data.baseUnit         != null && { baseUnit:         data.baseUnit }),
            ...(data.barcode          != null && { barcode:          data.barcode }),
            ...(data.isDefault        != null && { isDefault:        data.isDefault }),
            ...(data.isActive         != null && { isActive:         data.isActive }),
            ...(data.minOrderQty      != null && { minOrderQty:      data.minOrderQty }),
            ...(data.maxOrderQty      != null && { maxOrderQty:      data.maxOrderQty }),
            ...(data.reorderPoint     != null && { reorderPoint:     data.reorderPoint }),
          },
        })
      },
    })

    // Soft delete — set isActive: false instead of deleting
    // so historical orders that reference this unit still resolve
    t.nonNull.field("deactivateInventoryItemUnit", {
      type: "InventoryItemUnit",
      args: { id: nonNull(intArg()) },
      resolve: (_root, { id }, ctx) =>
        ctx.prisma.inventoryItemUnit.update({
          where: { id },
          data:  { isActive: false },
        }),
    })
  },
})
