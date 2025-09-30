import { extendType, nonNull, intArg, objectType } from "nexus";
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

export const ItemQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("getItems", {
      type:"Item",
      async resolve(_, __, ctx){
        requireAuth(ctx),
        requireRole(ctx, ["ADMIN", "MANAGER"])
      }
    }),
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
