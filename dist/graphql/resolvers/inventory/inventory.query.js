import { extendType, nonNull, intArg, stringArg } from "nexus";
import { requireAuth, requireOwnership, requireRole } from "../../../middleware/auth.middleware.js";
import * as inventoryService from "../../../services/inventory.service.js";
export const InventoryQuery = extendType({
    type: "Query",
    definition(t) {
        // Get inventory by outletId
        // Used by the create_new flow in route.ts:
        //   1. createItems mutation creates the Item row
        //   2. itemByName fetches the new item's id
        //   3. addItemsToInventory links it to the inventory
        t.nullable.field("itemByName", {
            type: "Item",
            args: {
                name: nonNull(stringArg()),
            },
            async resolve(_, { name }, ctx) {
                return ctx.prisma.item.findUnique({
                    where: { name },
                    include: {
                        category: true,
                        brandDetails: true,
                        color: true,
                        purchaseUnit: true,
                        media: { orderBy: { sortOrder: "asc" } },
                    },
                });
            },
        });
        // inventory.query.ts  — add inside the extendType definition(t) block
        t.nullable.field("inventoryItemByKeys", {
            type: "InventoryItems",
            args: {
                inventoryId: nonNull(intArg()),
                itemId: nonNull(intArg()),
            },
            async resolve(_, { inventoryId, itemId }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                return ctx.prisma.inventoryItems.findUnique({
                    where: { inventoryId_itemId: { inventoryId, itemId } },
                });
            },
        });
        t.field("getInventoryByOutletId", {
            type: "Outlet",
            args: {
                outletId: nonNull(intArg()),
            },
            async resolve(_, { outletId }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                await requireOwnership(ctx, "Outlet", outletId);
                try {
                    const inventory = await inventoryService.getInventoryByOutletId(Number(outletId));
                    if (!inventory) {
                        throw new Error("Error getting inventory by Outlet");
                    }
                    return inventory;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting Inventory:", error);
                    throw new Error("Failed to get inventory.");
                }
            },
        });
        // !GET invetory Items
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
                    return await inventoryService.getInventoryItemsByRack(inventoryId, rackName);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error retrieving Inventory:", error);
                    throw new Error("Failed to fetch inventory items by rack.");
                }
            },
        });
    },
});
