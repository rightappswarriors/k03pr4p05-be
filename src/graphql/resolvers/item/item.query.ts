// rai-pos-backend\src\graphql\resolvers\item\item.query.ts
import { extendType, nonNull, intArg, objectType, nullable, stringArg, enumType, arg, list } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as itemService from "../../../services/item.service.js";
import { PAGE_PERMISSIONS } from "../../../lib/permissions.map.js";

// Define custom type for grouped result
export const ItemsByRack = objectType({
  name: "ItemsByRack",
  definition(t) {
    t.nonNull.string("rack");
    t.nonNull.list.nonNull.field("items", { type: "InventoryItems" });
  },
});
export const orderBy = enumType({
  name: "orderBy",
  members: ["asc", "desc"]
})
export const ItemQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("items", {
      type: "Item",
      args: {
        search: nullable(stringArg()),
        excludeIds: nullable(list(nonNull(intArg()))),
        limit: nullable(intArg()),
      },
      async resolve(_, { search, excludeIds, limit }, ctx) {
        requireAuth(ctx);
        return ctx.prisma.item.findMany({
          where: {
            ...(search && { name: { contains: search, mode: "insensitive" } }),
            ...(excludeIds?.length && { id: { notIn: excludeIds } }),
          },
          take: limit ?? 30,
          orderBy: { name: "asc" },
          include: {
            category: true,
            brandDetails: true,
            color: true,
            purchaseUnit: true,
            media: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        });
      },
    })
    t.nullable.field("itemByName", {
      type: "Item",
      args: { name: nonNull(stringArg()) },
      async resolve(_, { name }, ctx) {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'STAFF'])
        PAGE_PERMISSIONS.inventory.view(ctx)
        return ctx.prisma.item.findUnique({
          where: { name },
        })
      },
    })
    t.nonNull.list.nonNull.field("getItems", {
      type: "Item",
      args: {
        query: nullable(stringArg()),
        size: nullable(intArg()),
        orderBy: nullable(arg({ type: "orderBy" }))
      },
      async resolve(_, { query, size, orderBy }, ctx) {
        size = size ? size : 20;
        orderBy = orderBy ? orderBy : "asc"
        requireAuth(ctx)
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", 'STAFF'])
        PAGE_PERMISSIONS.inventory.view(ctx)
        const orgId = Number(ctx.user.orgId)
        try {
          const items = await itemService.getItems(query, size, orderBy, orgId)

          if (!items) {
            throw new Error("No items found")
          }
          return items
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error querying items", error)
          throw new Error("Error getting items")
        }
      }
    }),
      t.nonNull.field("getItemById", {
        type: "Item",
        args: {
          id: nonNull(arg({ type: "ID" }))
        },
        async resolve(_, { id }, ctx) {
          requireAuth(ctx)
          requireRole(ctx, ["ADMIN", "MANAGER", 'STAFF'])
          PAGE_PERMISSIONS.inventory.view(ctx)
          try {
            const item = await itemService.getItemById(Number(id))
            if (!item) {
              throw new Error("Item not found")
            }
            return item
          } catch (error) {
            if (process.env.NODE_ENV === "development") console.error("Error getting Item:", error)
            throw new Error("Error getting Item.")
          }
        }
      })
    t.nonNull.list.nonNull.field("itemCostHistory", {
      type: "ItemCostHistory",
      args: {
        itemId: nonNull(intArg()),
      },

      async resolve(_, { itemId }, ctx) {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'STAFF'])
        PAGE_PERMISSIONS.inventory.view(ctx)
        return ctx.prisma.itemCostHistory.findMany({
          where: { itemId },
          orderBy: { effectiveAt: "desc" },
        })
      },
    })
    t.nonNull.list.nonNull.field("itemPriceHistory", {
      type: "ItemPriceHistory",
      args: {
        itemId: nonNull(intArg()),
      },
      async resolve(_, { itemId }, ctx) {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'STAFF'])
        PAGE_PERMISSIONS.inventory.view(ctx)
        return ctx.prisma.itemPriceHistory.findMany({
          where: { itemId },
          orderBy: { effectiveAt: "desc" },
        })
      },
    })
    t.nonNull.list.nonNull.field("getInventoryItemsByRack", {
      type: "ItemsByRack",
      args: {
        outletId: nonNull(intArg()),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", 'STAFF', "MANAGER"]);
        PAGE_PERMISSIONS.inventory.view(ctx)
        // Find the inventory by outletId
        const inventory = await ctx.prisma.inventory.findUnique({
          where: { outletId },
        });
        if (!inventory) {
          throw new Error("Inventory not found for this outlet.");
        }

        const itemsByRack = await itemService.getInventoryItemsByRack(
          inventory.id
        );

        if (!itemsByRack) {
          throw new Error("No inventory items found for this store.");
        }

        // Transform map { rack: [items] } into array of { rack, items }
        return Object.entries(itemsByRack).map(([rack, items]) => ({
          rack,
          items,
        }));
      },
    });
  },
});
