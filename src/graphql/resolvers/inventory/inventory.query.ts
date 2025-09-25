import { extendType, nonNull, intArg, stringArg, list, arg } from "nexus";
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
        await requireOwnership(ctx, "Invetory", outletId)
        try {
          return await inventoryService.getInventoryByOutletId(Number(outletId));
        } catch (error) {
          console.error("Error getting Inventory:", error);
          throw new Error("Failed to get inventory.");
        }
      },
    });

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
