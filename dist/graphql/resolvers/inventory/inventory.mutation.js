import { extendType, nonNull, intArg, stringArg, list, arg, objectType, inputObjectType, floatArg } from "nexus";
import { requireAuth, requireOwnership, requireRole, } from "../../../middleware/auth.middleware.js";
import * as inventoryService from "../../../services/inventory.service.js";
export const BatchPayload = objectType({
    name: "BatchPayload",
    definition(t) {
        t.nonNull.int("count");
    },
});
export const AddItemToInventoryInput = inputObjectType({
    name: "AddItemToInventoryInput",
    definition(t) {
        t.nonNull.int("itemId");
        t.nonNull.int("quantity");
        t.nonNull.float("price");
        t.nullable.int("categoryId");
    }
});
export const AddItemToInventoryWithUnitsInput = inputObjectType({
    name: "AddItemToInventoryWithUnitsInput",
    definition(t) {
        t.nonNull.int("itemId");
        t.nonNull.int("quantity");
        t.nonNull.float("price");
        t.int("minQuantity");
        t.float("opExPct");
        t.list.field("costLines", { type: "CostLineInput" });
        t.float("priceB");
        t.float("priceC");
        t.list.field("units", { type: "CreateInventoryItemUnitInput" });
    }
});
export const InventoryMutation = extendType({
    type: "Mutation",
    definition(t) {
        // Create new inventory
        t.field("createInventory", {
            type: "Inventory",
            args: {
                outletId: nonNull(intArg()), name: stringArg(),
            },
            async resolve(_, { outletId, name }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER"]);
                await requireOwnership(ctx, "Outlet", Number(outletId));
                try {
                    return await inventoryService.createInventory(name ?? "", outletId);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
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
                requireRole(ctx, ["ADMIN", "OWNER"]);
                try {
                    return await inventoryService.updateInventory(id, name);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
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
                requireRole(ctx, ["ADMIN", "OWNER"]);
                await requireOwnership(ctx, "Invetory", id);
                try {
                    await inventoryService.deleteInventory(id);
                    return true;
                }
                catch (error) {
                    if (error.code === "P2025") {
                        throw new Error("Inventory not found.");
                    }
                    if (process.env.NODE_ENV === "development")
                        console.error("Error deleting Inventory:", error);
                    throw new Error("Failed to delete inventory.");
                }
            },
        });
        //! Create inventory items
        t.field("addItemsToInventory", {
            type: "BatchPayload", // Prisma createMany returns { count }
            args: {
                inventoryId: nonNull(arg({ type: "ID" })),
                items: nonNull(list(nonNull(arg({
                    type: "AddItemToInventoryInput", // You'll need to define this input type
                })))),
            },
            async resolve(_, { inventoryId, items }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                inventoryId = Number(inventoryId);
                const inventory = await ctx.prisma.inventory.findFirst({
                    where: { id: inventoryId },
                    select: {
                        outlet: {
                            select: { id: true }
                        }
                    }
                });
                if (!inventory || !inventory.outlet) {
                    throw new Error("Can't find Inventory or Outlet");
                }
                await requireOwnership(ctx, "outlet", inventory.outlet.id);
                try {
                    return await inventoryService.createInventoryItem(items, inventoryId);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error creating Inventory Items:", error);
                    throw new Error("Failed to create inventory items.");
                }
            },
        });
        // Add item to inventory with units
        t.field("addItemToInventoryWithUnits", {
            type: "InventoryItems",
            args: {
                outletId: nonNull(arg({ type: "ID" })),
                data: nonNull(arg({ type: "AddItemToInventoryWithUnitsInput" })),
            },
            async resolve(_, { outletId, data }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                outletId = Number(outletId);
                const outlet = await ctx.prisma.outlet.findUnique({
                    where: { id: outletId },
                    select: {
                        id: true, orgId: true,
                        inventory: {
                            select: { id: true }
                        }
                    },
                });
                if (!outlet) {
                    throw new Error("Can't find Outlet");
                }
                const inventory = await ctx.prisma.inventory.findFirst({
                    where: { id: outlet.inventory?.id },
                    select: {
                        id: true,
                        outlet: {
                            select: { id: true }
                        }
                    }
                });
                if (!inventory || !inventory.outlet) {
                    throw new Error("Can't find Inventory");
                }
                await requireOwnership(ctx, "outlet", inventory.outlet.id);
                try {
                    return await inventoryService.addItemToInventoryWithUnits(data, inventory.id, ctx.user.orgId);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error creating Inventory Item with units:", error);
                    throw new Error("Failed to add item to inventory with units.");
                }
            },
        });
        // Create Item
        t.field("createItem", {
            type: "Item",
            args: {
                data: nonNull(arg({ type: "CreateItemInput" })),
            },
            async resolve(_, { data }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
                if (process.env.NODE_ENV === "development")
                    console.log("Incoming data:", JSON.stringify(data, null, 2));
                try {
                    const totalCost = data.costLines?.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) ?? 0;
                    const item = await ctx.prisma.item.create({
                        data: {
                            name: data.name,
                            description: data.description,
                            stock: data.stock,
                            barcode: data.barcode,
                            brand: data.brand ?? null,
                            ServiceCharge: data.ServiceCharge ?? false,
                            image: data.image ?? null,
                            brandId: data.brandId,
                            itemCode: data.itemCode,
                            categoryId: data.categoryId,
                            skuNumber: data.skuNumber,
                            vatExempt: data.vatExempt ?? false,
                            assembly: data.assembly ?? false,
                            priceB: data.priceB ?? null,
                            priceC: data.priceC ?? null,
                            sellingPrice: data.sellingPrice,
                            totalCost: totalCost,
                            opExPct: data.opExPct,
                            costLines: data.costLines?.length
                                ? {
                                    create: data.costLines.map((line) => ({
                                        label: line.label,
                                        amount: line.amount,
                                    })),
                                }
                                : undefined,
                            orgId: ctx.user.orgId,
                        },
                        include: {
                            costLines: true,
                            category: true,
                            brandDetails: true,
                        },
                    });
                    if (process.env.NODE_ENV === "development")
                        console.log("Created item:", JSON.stringify(item, null, 2));
                    return item;
                }
                catch (error) {
                    if (error.code === "P2002") {
                        throw new Error(`Item with name "${data.name}" already exists in your organization.`);
                    }
                    if (process.env.NODE_ENV === "development")
                        console.error("Error creating item:", error);
                    throw new Error("Failed to create item.");
                }
            },
        });
        // Update Item
        t.field("updateItem", {
            type: "Item",
            args: {
                id: nonNull(intArg()),
                data: nonNull(arg({ type: "UpdateItemInput" })),
            },
            async resolve(_, { id, data }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
                try {
                    const existingItem = await ctx.prisma.item.findUnique({
                        where: { id },
                        select: { orgId: true },
                    });
                    if (!existingItem) {
                        throw new Error("Item not found.");
                    }
                    if (existingItem.orgId !== ctx.user.orgId) {
                        throw new Error("Unauthorized to update this item.");
                    }
                    const { costLines, ...updateData } = data;
                    const item = await ctx.prisma.item.update({
                        where: { id },
                        data: {
                            ...updateData,
                            stock: data.stock,
                        },
                        include: {
                            category: true,
                            brandDetails: true,
                        },
                    });
                    return item;
                }
                catch (error) {
                    if (error.code === "P2002") {
                        throw new Error(`Item with name "${data.name}" already exists.`);
                    }
                    if (process.env.NODE_ENV === "development")
                        console.error("Error updating item:", error);
                    throw new Error("Failed to update item.");
                }
            },
        });
        // Update Inventory Item (with cost breakdown)
        t.field("updateInventoryItem", {
            type: "InventoryItems",
            args: {
                id: nonNull(intArg()),
                quantity: intArg(),
                price: floatArg(),
                minQuantity: intArg(),
                costLines: list(nonNull(arg({ type: "CostLineInput" }))),
                opExPct: floatArg(),
                priceB: floatArg(),
                priceC: floatArg(),
            },
            async resolve(_, { id, quantity, price, minQuantity, costLines, opExPct, priceB, priceC }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
                try {
                    const inventoryItem = await ctx.prisma.inventoryItems.findUnique({
                        where: { id },
                        include: {
                            inventory: {
                                select: {
                                    outlet: {
                                        select: { id: true, orgId: true },
                                    },
                                },
                            },
                        },
                    });
                    if (!inventoryItem) {
                        throw new Error("Inventory item not found.");
                    }
                    if (inventoryItem.inventory.outlet.orgId !== ctx.user.orgId) {
                        throw new Error("Unauthorized to update this item.");
                    }
                    const totalCost = costLines?.reduce((sum, line) => sum + line.amount, 0) ?? inventoryItem.totalCost;
                    const updated = await ctx.prisma.inventoryItems.update({
                        where: { id },
                        data: {
                            quantity: quantity ?? inventoryItem.quantity,
                            price: price ?? inventoryItem.price,
                            minQuantity: minQuantity ?? inventoryItem.minQuantity,
                            costJson: costLines ? costLines : inventoryItem.costJson,
                            totalCost,
                            opExPct: opExPct ?? inventoryItem.opExPct,
                            priceB: priceB ?? inventoryItem.priceB,
                            priceC: priceC ?? inventoryItem.priceC,
                        },
                        include: {
                            item: true,
                            inventory: true,
                        },
                    });
                    return updated;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error updating inventory item:", error);
                    throw new Error("Failed to update inventory item.");
                }
            },
        });
    },
});
