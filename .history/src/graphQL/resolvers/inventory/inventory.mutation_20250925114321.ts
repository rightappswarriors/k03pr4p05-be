import { extendType, nonNull, intArg, stringArg, list, arg, objectType, inputObjectType } from "nexus";
import {
  requireAuth,
  requireOwnership,
  requireRole,
} from "../../../middleware/auth.middleware.js";
import * as inventoryService from "../../../services/inventory.service.js";

export const BatchPayload = objectType({
  name: "BatchPayload",
  definition(t) {
    t.nonNull.int("count");
  },
});

export const InventoryItemInput = inputObjectType({
  name: "InventoryItemInput",
  definition(t) {
    t.nonNull.int("itemId");
    t.nonNull.int("quantity");
    t.field("locationData", { type: "LocationInput" });
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
      async resolve(_, { outletId, name }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await inventoryService.createInventory(name ?? "", outletId);
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
        await requireOwnership(ctx, "Invetory", id);
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
      type: BatchPayload, // Prisma createMany returns { count }
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
