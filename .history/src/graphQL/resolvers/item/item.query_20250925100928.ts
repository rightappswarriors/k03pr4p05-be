import { extendType, arg, nonNull, list, intArg } from "nexus";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";
import * as itemService from "../../../services/item.service.js";

export const ItemMutation = extendType({
  type: "Mutation",
  definition(t) {
    // Bulk create items
    t.nonNull.list.nonNull.field("bulkCreateInventoryItems", {
      type: "InventoryItems",
      args: {
        items: nonNull(
          list(
            nonNull(
              arg({
                type: "InventoryItemInput", // 👈 define input type in schema
              })
            )
          )
        ),
      },
      async resolve(_, { items }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        if (!items.length) {
          throw new Error("Request body must be a non-empty array of items.");
        }

        try {
          return await itemService.bulkCreateItems(items);
        } catch (error) {
          console.error("Error in bulkCreateInventoryItems:", error);
          throw new Error("An internal server error occurred.");
        }
      },
    });

    // Update item
    t.nonNull.field("updateInventoryItem", {
      type: "InventoryItems",
      args: {
        id: nonNull(intArg()),
        data: nonNull(
          arg({
            type: "InventoryItemUpdateInput", // 👈 define input type
          })
        ),
      },
      async resolve(_, { id, data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        try {
          return await itemService.updateInventoryItem(id, data);
        } catch (error) {
          console.error("Error updating inventory item:", error);
          throw new Error("Error updating inventory item.");
        }
      },
    });

    // Delete item
    t.nonNull.field("deleteInventoryItem", {
      type: "InventoryItems",
      args: {
        id: nonNull(intArg()),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await itemService.deleteInventoryItem(id);
        } catch (error) {
          console.error("Error deleting inventory item:", error);
          throw new Error("Error deleting inventory item.");
        }
      },
    });
  },
});

export const ItemQuery = extendType({
  type: "Query",
  definition(t) {
    // Get items by rack (storeId)
    t.nonNull.list.nonNull.field("getInventoryItemsByRack", {
      type: "InventoryItems",
      args: {
          outletId: nonNull(intArg()),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        try {
          const itemsByRack = await itemService.getInventoryItemsByRack(outletId);
          if (!itemsByRack || itemsByRack.length === 0) {
            throw new Error("No inventory items found for this store.");
          }
          return itemsByRack;
        } catch (error) {
          console.error("Error retrieving items by rack:", error);
          throw new Error("An internal server error occurred.");
        }
      },
    });
  },
});
