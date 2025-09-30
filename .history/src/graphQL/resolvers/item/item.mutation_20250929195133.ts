import { inputObjectType } from "nexus";
export const LocationInput = inputObjectType({
     name: "LocationInput",
     definition(t) {
          t.nullable.string("aisle")
          t.nullable.string("rack")
          t.nullable.string("shelf")
     }
})

export const ItemInput = inputObjectType({
     name: "ItemInput",
     definition(t) {
          t.nonNull.int("id")
     }
})

export const InventoryItemInput = inputObjectType({
  name: "InventoryItemInput",
  definition(t) {
    t.nonNull.int("inventoryId");
    t.nonNull.int("quantity");
    t.nonNull.float("price");
    t.nonNull.string("name"); // if you create/update items by name
    t.field("locationData", { type: LocationInput }); // 👈 optional nested
    t.field("itemData", { type: ItemInput });         // 👈 optional nested
  },
});

export const InventoryItemUpdateInput = inputObjectType({
  name: "InventoryItemUpdateInput",
  definition(t) {
    t.int("quantity");
    t.string("name");
    t.field("locationData", { type: "LocationInput" });
    t.field("itemData", { type: "ItemInput" });
  },
});

// Define LocationInput, ItemInput similarly

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