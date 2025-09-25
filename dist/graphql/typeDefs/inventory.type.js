import { objectType } from "nexus";
export const Inventory = objectType({
    name: "Inventory",
    definition(t) {
        t.nonNull.int("id");
        t.nullable.string("name");
        t.nonNull.int("outletId"); // Added to match the Prisma model
        // Relationship to the Outlet this inventory belongs to
        t.nonNull.field("outlet", {
            type: "Outlet",
            resolve: (parent, args, ctx) => {
                return ctx.prisma.inventory
                    .findUnique({ where: { id: parent.id } })
                    .outlet();
            },
        });
        t.nonNull.list.nonNull.field("items", {
            type: "InventoryItems",
            resolve: (parent, args, ctx) => {
                return ctx.prisma.inventoryItems
                    .findUnique({
                    where: { id: parent.id },
                })
                    .items();
            },
        });
    },
});
