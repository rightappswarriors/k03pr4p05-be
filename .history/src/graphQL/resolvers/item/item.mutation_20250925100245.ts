import { inputObjectType } from "nexus";

export const InventoryItemInput = inputObjectType({
  name: "InventoryItemInput",
  definition(t) {
    t.nonNull.int("inventoryId");
    t.nonNull.int("quantity");
    t.nonNull.string("name"); // if you create/update items by name
    t.field("locationData", { type: "LocationInput" }); // 👈 optional nested
    t.field("itemData", { type: "ItemInput" });         // 👈 optional nested
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
