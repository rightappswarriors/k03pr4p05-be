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
                if (parent.inventory)
                    return parent.inventory;
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
                if (parent.item)
                    return parent.item;
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
                if (Array.isArray(parent.units))
                    return parent.units;
                return ctx.prisma.inventoryItemUnit.findMany({
                    where: { inventoryItemId: parent.id, isActive: true },
                    orderBy: [{ isDefault: "desc" }, { price: "asc" }],
                });
            },
        });
        // ─── Units ───────────────────────────────────────────────────────────
        t.list.field("units", {
            type: "InventoryItemUnit",
            resolve: (parent, _, ctx) => Array.isArray(parent.units)
                ? parent.units
                :
                    ctx.prisma.inventoryItemUnit.findMany({
                        where: { inventoryItemId: parent.id, isActive: true },
                    }),
        });
        // ─── Inventory → Outlet tag ───────────────────────────────────────────
        // Required by the "show all org items, tag each with outlet name" feature.
        // When outletId IS selected this field is ignored by the frontend.
        t.nullable.field("inventory", {
            type: "InventoryForItem",
            resolve: (parent, _, ctx) => parent.inventory
                ? parent.inventory
                :
                    ctx.prisma.inventory.findUnique({
                        where: { id: parent.inventoryId },
                        include: {
                            outlet: { select: { id: true, name: true, code: true } },
                        },
                    }),
        });
    },
});
