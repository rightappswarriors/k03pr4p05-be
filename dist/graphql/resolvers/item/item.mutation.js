// rai-pos-backend\src\graphql\resolvers\item\item.mutation.ts
import { extendType, arg, nonNull, list, intArg } from "nexus";
import { requireAuth, requireRole, } from "../../../middleware/auth.middleware.js";
import * as itemService from "../../../services/item.service.js";
import { inputObjectType } from "nexus";
export const LocationInput = inputObjectType({
    name: "LocationInput",
    definition(t) {
        t.nullable.string("aisle");
        t.nullable.string("rack");
        t.nullable.string("shelf");
    },
});
export const CostLineInput = inputObjectType({
    name: "CostLineInput",
    definition(t) {
        t.nonNull.string("label");
        t.nonNull.float("amount");
    },
});
export const CreateItemInput = inputObjectType({
    name: "CreateItemInput",
    definition(t) {
        t.nonNull.string("name");
        t.nonNull.string("barcode");
        t.nullable.string("image");
        t.nullable.string("description");
        t.nullable.string("brand");
        t.nullable.int("categoryId");
        t.nonNull.float("sellingPrice");
        t.nullable.int("categoryId"); // global category
        t.nullable.int("orgCategoryId"); // ✅ org category
        t.nonNull.int("stock"); // ← new required field
        t.nullable.int("brandId"); // ← missing
        t.nullable.string("itemCode"); // ← missing
        t.nullable.string("skuNumber"); // ← missing
        t.nullable.boolean("vatExempt"); // ← missing
        t.nullable.boolean("ServiceCharge"); // ← missing
        t.nullable.boolean("assembly"); // ← missing
        t.list.field("costLines", { type: "CostLineInput" }); // ← new field
        t.nullable.float("opExPct"); // ← new field
        t.nullable.float("priceB"); // ← new field
        t.nullable.float("priceC"); // ← new field
        t.nullable.int("minQuantity"); // ← new field
        t.nullable.int("vatTypeId");
    },
});
export const ItemInput = inputObjectType({
    name: "ItemInput",
    definition(t) {
        t.nonNull.int("id");
    },
});
export const InventoryItemInput = inputObjectType({
    name: "InventoryItemInput",
    definition(t) {
        t.nonNull.int("inventoryId");
        t.nonNull.int("quantity");
        t.nonNull.float("price");
        t.nonNull.string("name"); // if you create/update items by name
        t.field("locationData", { type: LocationInput }); // 👈 optional nested
        t.field("itemData", { type: ItemInput }); // 👈 optional nested
    },
});
export const InventoryItemUpdateInput = inputObjectType({
    name: "InventoryItemUpdateInput",
    definition(t) {
        t.int("quantity");
        t.nullable.float("price");
        t.string("name");
        t.field("locationData", { type: "LocationInput" });
        t.field("itemData", { type: "ItemInput" });
    },
});
export const UpdateItemInput = inputObjectType({
    name: "UpdateItemInput",
    definition(t) {
        t.nullable.string("name");
        t.nullable.string("image");
        t.nullable.string("description");
        t.nullable.string("barcode");
        t.nullable.string("brand");
        t.nonNull.float("sellingPrice");
        t.list.field("costLines", { type: "CostLineInput" });
        t.nullable.int("brandId");
        t.nullable.string("itemCode");
        t.nullable.int("categoryId");
        t.nullable.int("stock");
        t.nullable.float("priceB");
        t.nullable.int("categoryId"); // global
        t.nullable.int("orgCategoryId"); // ✅ org
        t.nullable.float("priceC");
        t.nullable.float("opExPct");
        t.nullable.int("minQuantity");
        t.nullable.boolean("vatExempt");
        t.nullable.boolean("ServiceCharge");
        t.nullable.boolean("assembly");
        t.nullable.string("skuNumber");
        t.nullable.int("vatTypeId");
    },
});
export const ItemMutation = extendType({
    type: "Mutation",
    definition(t) {
        t.nonNull.field("createItems", {
            type: "BatchPayload",
            args: {
                items: nonNull(list(nonNull(arg({ type: "CreateItemInput" })))),
            },
            async resolve(_, { items }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                if (items.length === 0) {
                    throw new Error("Request body must be a non-empty array of items.");
                }
                try {
                    const createdItems = await itemService.bulkCreateItems(items);
                    return { count: createdItems };
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("❌ Error creating items:", error);
                    throw new Error("An internal server error occurred while creating items.");
                }
            },
        });
        t.nonNull.field("updateItem", {
            type: "Item",
            args: {
                id: nonNull(arg({ type: "ID" })),
                data: nonNull(arg({ type: "UpdateItemInput" })),
            },
            async resolve(_, { id, data }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                // check if all fields are null/undefined
                const hasAtLeastOneField = Object.values(data).some((value) => value !== null && value !== undefined);
                if (!hasAtLeastOneField) {
                    throw new Error("You must provide at least one field to update.");
                }
                try {
                    const updatedItem = await itemService.updateItem(Number(id), data);
                    if (!updatedItem) {
                        throw new Error("Item not found");
                    }
                    return updatedItem;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error updating item", error);
                    throw new Error("Error updating item");
                }
            },
        }),
            t.nonNull.field("deleteItem", {
                type: "Item",
                args: {
                    id: nonNull(arg({ type: "ID" })),
                },
                async resolve(_, { id }, ctx) {
                    requireAuth(ctx);
                    requireRole(ctx, ["ADMIN", "MANAGER"]);
                    try {
                        const deletedItem = await itemService.deleteItem(Number(id));
                        if (!deletedItem) {
                            throw new Error("Item not found");
                        }
                        return deletedItem;
                    }
                    catch (error) {
                        if (process.env.NODE_ENV === "development")
                            console.error("Error deleting item", error);
                        throw new Error("Error deleting item");
                    }
                },
            });
        // Bulk create items
        t.nonNull.list.nonNull.field("bulkCreateInventoryItems", {
            type: "InventoryItems",
            args: {
                items: nonNull(list(nonNull(arg({
                    type: "InventoryItemInput", // 👈 define input type in schema
                })))),
            },
            async resolve(_, { items }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                if (items.length === 0) {
                    throw new Error("Request body must be a non-empty array of items.");
                }
                try {
                    return await itemService.createOrUpdateMultipleInventoryItems(items);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
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
                data: nonNull(arg({
                    type: "InventoryItemUpdateInput", // 👈 define input type
                })),
            },
            async resolve(_, { id, data }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                try {
                    return await itemService.updateInventoryItem(id, data);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error updating inventory item:", error);
                    throw new Error("Error updating inventory item.");
                }
            },
        });
        // Delete Inventory Item
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
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error deleting inventory item:", error);
                    throw new Error("Error deleting inventory item.");
                }
            },
        });
    },
});
