import { extendType, nonNull, intArg, objectType, nullable, stringArg, enumType, arg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as itemService from "../../../services/item.service.js";

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
    t.nonNull.list.nonNull.field("getItems", {
      type:"Item",
      args: {
        query: nullable(stringArg()),
        size: nullable(intArg()),
        orderBy: nullable(arg({type: "orderBy"}))
      },
      async resolve(_, {query, size, orderBy}, ctx){
        size = size ? size: 20;
        orderBy = orderBy? orderBy : "asc"
        requireAuth(ctx),
        requireRole(ctx, ["ADMIN", "MANAGER"])
        try {
          const items = await itemService.getItems(query, size, orderBy)
          
          if (!items) {
            throw new Error("No items found")
          }
          return items
        } catch (error) {
          console.error("Error querying items", error)
          throw new Error("Error getting items")
        }
      }
    }),
    t.nonNull.field("getItemById", {
      type: "Item",
      args: {
        id: nonNull(intArg())
      },
      async resolve(_, {id}, ctx) {
        requireAuth(ctx)
        requireRole(ctx, ["ADMIN", "MANAGER"])
        try {
          const item = await itemService.getItemById(Number(id))
          if (!item) {
            throw new Error("Item not found")
          }
          return item
        }catch(error) {
          console.error("Error getting Item:", error)
          throw new Error("Error getting Item.")
        }
      }
    })
    t.nonNull.list.nonNull.field("getInventoryItemsByRack", {
      type: "ItemsByRack",
      args: {
        outletId: nonNull(intArg()),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

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
