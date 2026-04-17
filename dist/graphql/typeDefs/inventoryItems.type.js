import { objectType } from "nexus";
export const InventoryItems = objectType({
    name: "InventoryItems",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("inventoryId");
        t.nonNull.int("itemId");
        t.nonNull.int("quantity");
        t.nullable.int("locationId");
        t.nullable.float('price');
        t.string("baseUnit");
        t.nonNull.field("inventory", {
            type: "Inventory",
            resolve: (parent, _, ctx) => {
                // Correct way to resolve the inventory from the inventory item
                return ctx.prisma.inventoryItems
                    .findUnique({ where: { id: parent.id } })
                    .inventory();
            },
        });
        t.nullable.int("categoryId");
        t.nullable.field("category", {
            type: "ItemCategory",
            resolve: (parent, _, ctx) => {
                // Correct way to resolve the category from the inventory item
                return ctx.prisma.inventoryItems
                    .findUnique({ where: { id: parent.id } })
                    .category();
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
        t.nonNull.list.nonNull.field("units", {
            type: "InventoryItemUnit",
            resolve: async (parent, _, ctx) => {
                return ctx.prisma.inventoryItemUnit.findMany({
                    where: { inventoryItemId: parent.id, isActive: true },
                    orderBy: [{ isDefault: "desc" }, { price: "asc" }],
                });
            },
        });
    },
});
