import { extendType, nonNull, intArg, stringArg, list, arg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as inventoryService from "../../../services/inventory.service.js";

export const InventoryQuery = extendType({
  type: "Query",
  definition(t) {
    // Get inventory by storeId
    t.field("getInventoryByStoreId", {
      type: "Inventory",
      args: {
        storeId: nonNull(intArg()),
      },
      async resolve(_, { storeId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        try {
          return await inventoryService.getInvetoryByStoreId(storeId);
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

export const InventoryMutation = extendType({
  type: "Mutation",
  definition(t) {
    // Create new inventory
    t.field("createInventory", {
      type: "Inventory",
      args: {
        storeId: nonNull(intArg()),
        name: stringArg(),
      },
      async resolve(_, { storeId, name }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await inventoryService.createInventory(name ?? "", storeId);
        } catch (error) {
          console.error("Error creating Inventory:", error);
          throw new Error("Failed to create inventory.");
        }
      },
    });

    // Update inventory
    t.field("updateInventory", {
      type: "Inventory",
      args: {
        id: nonNull(intArg()),
        name: nonNull(stringArg()),
      },
      async resolve(_, { id, name }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await inventoryService.updateInventory(id, name);
        } catch (error) {
          console.error("Error updating Inventory:", error);
          throw new Error("Failed to update inventory.");
        }
      },
    });

    // Delete inventory
    t.boolean("deleteInventory", {
      args: {
        id: nonNull(intArg()),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          await inventoryService.deleteInventory(id);
          return true;
        } catch (error) {
          if (error.code === "P2025") {
            throw new Error("Inventory not found.");
          }
          console.error("Error deleting Inventory:", error);
          throw new Error("Failed to delete inventory.");
        }
      },
    });

    // Create inventory items
    t.field("createInventoryItem", {
      type: "BatchPayload", // Prisma createMany returns { count }
      args: {
        inventoryId: nonNull(intArg()),
        items: nonNull(
          list(
            nonNull(
              arg({
                type: "InventoryItemInput", // You'll need to define this input type
              })
            )
          )
        ),
      },
      async resolve(_, { inventoryId, items }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        try {
          return await inventoryService.createInventoryItem(items, inventoryId);
        } catch (error) {
          console.error("Error creating Inventory Items:", error);
          throw new Error("Failed to create inventory items.");
        }
      },
    });
  },
});
