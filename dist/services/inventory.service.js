import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
/**
 * @description Creates a new inventory record for a given store.
 * This is typically a one-to-one relationship.
 * @param {number} outletId - The ID of the store to create an inventory for.
 * @returns {Promise<object>} The newly created inventory record.
 */
export const createInventory = async (name, outletId) => {
    // Step 1: Check if an inventory already exists for this store
    const existingInventory = await prisma.inventory.findUnique({
        where: {
            outletId: outletId,
        },
    });
    // If an inventory already exists, return it immediately to prevent the error
    if (existingInventory) {
        if (process.env.NODE_ENV === "development")
            console.log(`Inventory already exists for storeId ${outletId}, returning existing record.`);
        return existingInventory;
    }
    // Step 2: If no inventory exists, proceed with the creation logic
    let inventoryName = name;
    // If no name is provided, fetch the store's name to generate one
    if (!inventoryName) {
        const outlet = await prisma.outlet.findUnique({
            where: { id: outletId },
            select: {
                name: true,
            },
        });
        if (outlet && outlet.name) {
            // Check if the store's name already contains "inventory" (case-insensitive)
            if (outlet.name.toLowerCase().includes(" inventory")) {
                inventoryName = outlet.name;
            }
            else {
                inventoryName = `${outlet.name} Inventory`;
            }
        }
        else {
            // Fallback name if the store is not found or has no name
            inventoryName = "Default Inventory";
        }
    }
    // Step 3: Create the new inventory with the determined name and storeId
    const newInventory = await prisma.inventory.create({
        data: {
            name: inventoryName, // Use the determined inventoryName variable
            outlet: {
                connect: {
                    id: outletId,
                },
            },
        },
    });
    return newInventory;
};
/**
 * @description Retrieves a single inventory record by its storeId.
 * @param {number} outletId - The ID of the store.
 * @returns {Promise<object>} The inventory record.
 */
export const getInvetoryByStoreId = async (outletId) => {
    const storeInventory = await prisma.inventory.findUnique({
        where: { outletId: outletId },
        include: {
            outlet: true,
            items: {
                select: { item: true },
            },
        },
    });
    return storeInventory;
};
/**
 * @description Updates an existing inventory record.
 * @param {number} id - The ID of the inventory record to update.
 * @param {object} inventoryData - The data to update.
 * @returns {Promise<object>} The updated inventory record.
 */
export const updateInventory = async (id, name) => {
    const updatedInventory = await prisma.inventory.update({
        where: { id },
        data: name,
    });
    return updatedInventory;
};
/**
 * @description Deletes an inventory record and all of its associated inventory items.
 * Uses a transaction to ensure atomicity.
 * @param {number} id - The ID of the inventory record to delete.
 * @returns {Promise<void>}
 */
export const deleteInventory = async (id) => {
    await prisma.$transaction(async (tx) => {
        // Delete all inventory items associated with the inventory first.
        await tx.inventoryItems.deleteMany({
            where: {
                inventoryId: id,
            },
        });
        // Then, delete the inventory record itself.
        await tx.inventory.delete({
            where: {
                id: id,
            },
        });
    });
};
/**
 * Bulk creates multiple inventory items for a given inventory after validating the IDs.
 * @param {Array<object>} itemsData - An array of item objects with itemId and quantity.
 * @param {number} inventoryId - The ID of the inventory to add the items to.
 * @returns {Promise<object>} An object containing the count of created items.
 */
export const createInventoryItem = async (itemsData, inventoryId) => {
    // --- Step 1: Validate the Inventory ID ---
    const inventory = await prisma.inventory.findUnique({
        where: { id: inventoryId },
    });
    if (!inventory) {
        throw new Error(`Inventory with ID ${inventoryId} not found.`);
    }
    // --- Step 2: Validate the Item IDs ---
    const itemIds = itemsData.map((item) => item.itemId);
    const uniqueItemIds = [...new Set(itemIds)];
    const existingItems = await prisma.item.findMany({
        where: {
            id: { in: uniqueItemIds },
        },
    });
    if (existingItems.length !== uniqueItemIds.length) {
        const existingItemIds = existingItems.map((item) => item.id);
        const missingItemIds = uniqueItemIds.filter((id) => !existingItemIds.includes(id));
        throw new Error(`One or more items not found: IDs ${missingItemIds.join(", ")}.`);
    }
    // --- Step 3: Bulk Create ---
    const itemsToCreate = itemsData.map((item) => ({
        ...item,
        inventoryId,
    }));
    const newInventoryItems = await prisma.inventoryItems.createMany({
        data: itemsToCreate,
        skipDuplicates: true,
    });
    return newInventoryItems;
};
/**
 * @description Creates a single inventory item with units for selling
 * @param {object} itemData - The item data including units
 * @param {number} inventoryId - The ID of the inventory
 * @returns {Promise<InventoryItems>} The created inventory item with units
 */
export const addItemToInventoryWithUnits = async (itemData, inventoryId, orgId) => {
    // --- Step 2: Validate the Item ID ---
    const item = await prisma.item.findUnique({
        where: { id: itemData.itemId, orgId: Number(orgId) },
    });
    if (!item) {
        throw new Error(`Item with ID ${itemData.itemId} not found.`);
    }
    // --- Step 3: Check if item already exists in inventory ---
    const existingItem = await prisma.inventoryItems.findUnique({
        where: {
            inventoryId_itemId: {
                inventoryId,
                itemId: itemData.itemId,
            },
        },
    });
    // --- Step 4: Create or update inventory item with units in transaction ---
    return await prisma.$transaction(async (tx) => {
        let inventoryItem;
        if (existingItem) {
            inventoryItem = await tx.inventoryItems.update({
                where: { id: existingItem.id },
                data: {
                    price: itemData.price,
                    quantity: existingItem.quantity + itemData.quantity,
                    categoryId: item.categoryId ?? null, // ✅ add
                },
                include: {
                    item: true,
                    units: true,
                },
            });
        }
        else {
            inventoryItem = await tx.inventoryItems.create({
                data: {
                    inventoryId,
                    itemId: itemData.itemId,
                    price: itemData.price,
                    quantity: itemData.quantity,
                    categoryId: item.categoryId ?? null, // ✅ add
                },
                include: {
                    item: true,
                    units: true,
                },
            });
        }
        // Create units if provided
        if (itemData.units && itemData.units.length > 0) {
            // If any unit is marked as default, ensure only one is default
            const hasDefault = itemData.units.some(u => u.isDefault);
            if (hasDefault) {
                // Find the first default unit, mark others as non-default
                const defaultIndex = itemData.units.findIndex(u => u.isDefault);
                itemData.units.forEach((unit, index) => {
                    if (index !== defaultIndex) {
                        unit.isDefault = false;
                    }
                });
            }
            for (const unit of itemData.units) {
                await tx.inventoryItemUnit.upsert({
                    where: {
                        inventoryItemId_unitName: {
                            inventoryItemId: inventoryItem.id,
                            unitName: unit.unitName,
                        },
                    },
                    create: {
                        inventoryItemId: inventoryItem.id,
                        unitName: unit.unitName,
                        unitLabel: unit.unitLabel,
                        price: unit.price,
                        quantity: unit.quantity,
                        conversionFactor: unit.conversionFactor,
                        baseUnit: unit.baseUnit ?? 'piece',
                        barcode: unit.barcode ?? null,
                        isDefault: unit.isDefault ?? false,
                        minOrderQty: unit.minOrderQty ?? null,
                        maxOrderQty: unit.maxOrderQty ?? null,
                        reorderPoint: unit.reorderPoint ?? null,
                    },
                    update: {
                        unitLabel: unit.unitLabel,
                        price: unit.price,
                        quantity: unit.quantity,
                        conversionFactor: unit.conversionFactor,
                        baseUnit: unit.baseUnit ?? 'piece',
                        barcode: unit.barcode ?? null,
                        isDefault: unit.isDefault ?? false,
                        minOrderQty: unit.minOrderQty ?? null,
                        maxOrderQty: unit.maxOrderQty ?? null,
                        reorderPoint: unit.reorderPoint ?? null,
                    },
                });
            }
        }
        if (process.env.NODE_ENV === 'development')
            console.log('Created/updated inventory item with units:', inventoryItem);
        const finalInventoryItem = await tx.inventoryItems.findUnique({
            where: { id: inventoryItem.id },
            include: { item: true, units: true },
        });
        return finalInventoryItem;
    });
};
/**
 * @description Retrieves inventory items by outletId.
 * @param {number} outletId - The ID of the outlet.
 * @returns {Promise<Inventory>} Inventory with all items and their details.
 */
export const getInventoryByOutletId = async (outletId) => {
    if (process.env.NODE_ENV === "development")
        console.log("Outlet ID received in resolver:", outletId);
    const outlet = await prisma.outlet.findFirst({
        where: { id: outletId },
        select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
            status: true,
            code: true,
            governmentTax: true,
            serviceCharge: true,
            outletType: true,
            inventory: {
                select: {
                    id: true,
                    name: true,
                    items: {
                        select: {
                            id: true,
                            itemId: true,
                            price: true,
                            quantity: true,
                            location: true,
                            item: {
                                select: {
                                    id: true,
                                    name: true,
                                    image: true,
                                    description: true,
                                    barcode: true,
                                    brand: true, // ← was missing
                                    skuNumber: true, // ← was missing
                                    itemCode: true, // ← was missing
                                    vatExempt: true, // ← was missing
                                    ServiceCharge: true, // ← was missing
                                    assembly: true, // ← was missing
                                    categoryId: true,
                                    brandId: true,
                                    category: true,
                                    brandDetails: true, // ← was missing
                                    color: true, // ← was missing
                                    purchaseUnit: true, // ← was missing
                                    media: {
                                        orderBy: { sortOrder: "asc" },
                                    },
                                },
                            },
                        },
                        orderBy: { id: "asc" },
                    },
                },
            },
        },
    });
    if (!outlet)
        return null;
    console.log(outlet);
    //console.log("Outlet Inventory:", outlet.inventory)
    console.log("Inventory Items:", outlet.inventory.items);
    return outlet;
};
/**
 * @description Retrieves all inventory items on a specific rack for a given inventory.
 * @param {number} inventoryId - The ID of the inventory to search.
 * @param {string} rackName - The name of the rack to filter by.
 * @returns {Promise<object[]>} An array of inventory items.
 */
export const getInventoryItemsByRack = async (inventoryId, rackName) => {
    const items = await prisma.inventoryItems.findMany({
        where: {
            inventoryId: inventoryId,
            // Filter by the rack field inside the nested location object.
            location: {
                rack: rackName,
            },
        },
        include: {
            location: true,
        },
    });
    return items;
};
// ─── InventoryItems ───────────────────────────────────────────────────────────
// Step 2 of the create-item flow: links existing Item rows to an Inventory.
// Uses createMany — faster than looping individual creates.
export const updateInventoryItem = async (id, data) => {
    return prisma.inventoryItems.update({
        where: { id },
        data: {
            ...(data.quantity != null && { quantity: data.quantity }),
            ...(data.price != null && { price: data.price }),
        },
        include: {
            item: { include: { category: true, brandDetails: true, media: { orderBy: { sortOrder: "asc" } } } },
            location: true,
        },
    });
};
export const deleteInventoryItem = async (id) => {
    return prisma.inventoryItems.delete({
        where: { id },
        include: { item: true },
    });
};
/**
 * @description Get all items for an organization
 */
export const getAllItems = async (orgId, query, size) => {
    const take = size || 100;
    return prisma.item.findMany({
        where: {
            orgId,
            ...(query && {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { barcode: { contains: query, mode: "insensitive" } },
                    { skuNumber: { contains: query, mode: "insensitive" } },
                    { brand: { contains: query, mode: "insensitive" } },
                ],
            }),
        },
        include: {
            category: true,
            brandDetails: true,
            costLines: true,
            media: { orderBy: { sortOrder: "asc" } },
        },
        take,
        orderBy: { name: "asc" },
    });
};
/**
 * @description Update inventory item with cost breakdown and pricing
 */
export const updateInventoryItemFull = async (id, data) => {
    return prisma.inventoryItems.update({
        where: { id },
        data: {
            quantity: data.quantity,
            price: data.price,
        },
        include: {
            item: { include: { category: true, brandDetails: true } },
            inventory: true,
        },
    });
};
