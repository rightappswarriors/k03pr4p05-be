import { extendType, nonNull, intArg, stringArg, arg } from "nexus";
import { requireAuth,requireOwnership, requireRole } from "../../../middleware/auth.middleware.js";
import * as inventoryService from "../../../services/inventory.service.js";

export const InventoryQuery = extendType({
  type: "Query",
  definition(t) {
    // Get inventory by outletId
    t.field("getInventoryByOutletId", {
      type: "Inventory",
      args: {
          outletId: nonNull(intArg()),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        await requireOwnership(ctx, "Outlet", outletId)
        try {
          const inventory= await inventoryService.getInventoryByOutletId(Number(outletId));
          if (!inventory) {
            throw new Error("Error getting inventory by Outlet")
          }
          return inventory
        } catch (error) {
          console.error("Error getting Inventory:", error);
          throw new Error("Failed to get inventory.");
        }
      },
    });
    // !GET invetory Items
    t.nonNull.list.nullable.field("getInventoryItemByOutletId", {
      type: "InventoryItems",
      args: {
        outletId: nonNull(arg({type: "ID"}))
      },
      async resolve(_, { outletId}, ctx) {
        requireAuth(ctx)
        requireRole(ctx, ["ADMIN", "MANAGER"])
        await requireOwnership(ctx, "outlet", outletId)
        try {
          const inventoryItems = await inventoryService.getInventoryByOutletId(Number(outletId))
          if (!inventoryItems) {
            throw new Error("No items found")
          }
          return inventoryItems
        } catch (error) {
          console.error("Error getting Inventory Items:", error);
          throw new Error("Failed to get inventory Items.");  
        }
      }
    })
    // Get inventory items by rack
    t.list.field("getInventoryItemsByRack", {
      type: "InventoryItems",
      args: {
        inventoryId: nonNull(intArg()),
        rackName: nonNull(stringArg()),
      },

      async resolve(_, { inventoryId, rackName }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        try {
          return await inventoryService.getInventoryItemsByRack(
            inventoryId,
            rackName
          );
        } catch (error) {
          console.error("Error retrieving Inventory:", error);
          throw new Error("Failed to fetch inventory items by rack.");
        }
      },
    });
  },
});
