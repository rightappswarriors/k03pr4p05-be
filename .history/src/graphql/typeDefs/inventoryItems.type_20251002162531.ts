import { objectType } from "nexus";

export const InventoryItems = objectType({
  name: "InventoryItems",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.int("inventoryId"); 
    t.nonNull.int("itemId");
    t.nonNull.int("quantity");
    t.nullable.int("locationId");
    t.nonNull.float('price')
    t.nonNull.field("inventory", {
      type: "Inventory",
      resolve: (parent, _, ctx) => {
        // Correct way to resolve the inventory from the inventory item
        return ctx.prisma.inventoryItems
          .findUnique({ where: { id: parent.id } })
          .inventory();
      },
    });

    t.nonNull.field("item", {
      type: "Item",
      resolve: (parent, _, ctx) => {
        // Correct way to resolve the item from the inventory item
        return ctx.prisma.inventoryItems
          .findUnique({ where: { id: parent.id } })
          .item();
      },
    });
    t.nullable.field("location", {
      type: "Location",
      resolve: (parent, _, ctx) => {
        // Correct way to resolve the location from the inventory item
        return ctx.prisma.inventoryItems
          .findUnique({ where: { id: parent.id } })
          .location();
      },
    });
  },
});
