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
    console.log(
      `Inventory already exists for storeId ${outletId}, returning existing record.`
    );
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
      } else {
        inventoryName = `${outlet.name} Inventory`;
      }
    } else {
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
export const createInventoryItem = async (
  itemsData: { itemId: number; quantity: number }[],
  inventoryId: number
) => {
  // --- Step 1: Validate the Inventory ID ---
  const inventory = await prisma.inventory.findUnique({
    where: { id: inventoryId },
  });

  if (!inventory) {
    throw new Error(`Inventory with ID ${inventoryId} not found.`);
  }

  // --- Step 2: Validate the Item IDs ---
  const itemIds = itemsData.map((item) => item.itemId);
  const uniqueItemIds: number[] = [...new Set(itemIds)];

  const existingItems = await prisma.item.findMany({
    where: {
      id: { in: uniqueItemIds },
    },
  });

  if (existingItems.length !== uniqueItemIds.length) {
    const existingItemIds = existingItems.map((item) => item.id);
    const missingItemIds = uniqueItemIds.filter(
      (id) => !existingItemIds.includes(id)
    );
    throw new Error(
      `One or more items not found: IDs ${missingItemIds.join(", ")}.`
    );
  }

  // --- Step 3: Bulk Create ---
  const itemsToCreate = itemsData.map((item) => ({
    ...item,
    inventoryId,
  }));

  const newInventoryItems = await prisma.inventoryItems.createMany({
    data: itemsToCreate,
  });

  return newInventoryItems;
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
