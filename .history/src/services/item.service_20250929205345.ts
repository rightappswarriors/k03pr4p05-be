import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Your existing service functions...

/**
 * Inserts multiple new items into the database in a single, efficient query.
 * @param {Array<object>} data - An array of item objects to create.
 * @returns {Promise<object>} An object containing the count of created items.
 */
export const bulkCreateItems = async (data) => {
    try {
    const result = await prisma.item.createMany({
      data: data,
      skipDuplicates: true,
    });
    console.log(`Successfully created ${result.count} items.`);
    return result;
  } catch (error) {
    console.error("Error with bulk item creation:", error);
    throw new Error("Failed to create all items.");
  }
};
/**
 * @description
 * Creates or updates multiple items, their associated InventoryItems, and Locations
 * in a single atomic transaction.
 *
 * @param {array} items - An array of item objects, each with itemData, locationData, inventoryId, and quantity.
 * @returns {Promise<object[]>} An array of the created/updated InventoryItems records.
 */
export const createOrUpdateMultipleInventoryItems = async (items) => {
  // Use a transaction to ensure all or none of the items are created/updated.
  return prisma.$transaction(async (tx) => {
    const operations = items.map(
      async ({ itemData, locationData, inventoryId, quantity }) => {
        // 1. Create or find the Item for each entry.
        const item = await tx.item.upsert({
          where: { name: itemData.name },
          update: { ...itemData },
          create: { ...itemData },
        });

        // 2. Create or update the InventoryItems record.
        return tx.inventoryItems.upsert({
          where: {
            inventoryId_itemId: {
              inventoryId: inventoryId,
              itemId: item.id,
            },
          },
          update: {
            quantity: {
              increment: quantity,
            },
            location: {
              update: { ...locationData },
            },
          },
          create: {
            inventory: { connect: { id: inventoryId } },
            item: { connect: { id: item.id } },
            quantity: quantity,
            location: { create: locationData },
            price: itemData.price
          },
          include: {
            item: true,
            location: true,
          },
        });
      }
    );

    return Promise.all(operations);
  });
};

/**
 * Updates an existing inventory item.
 * @param {number} id - The InventoryItems ID.
 * @param {object} data - The data to update.
 * @returns {Promise<object>} The updated InventoryItems record.
 */
export const updateInventoryItem = async (id, data) => {
  try {
    const updated = await prisma.inventoryItems.update({
      where: { id },
      data: {
        quantity: data.quantity,
        item: data.itemData ? { update: { ...data.itemData } } : undefined,
        location: data.locationData
          ? { update: { ...data.locationData } }
          : undefined,
      },
      include: {
        item: true,
        location: true,
      },
    });
    return updated;
  } catch (error) {
    console.error("Error updating inventory item:", error);
    throw new Error("Failed to update inventory item.");
  }
};

/**
 * Deletes an inventory item by ID.
 * @param {number} id - The InventoryItems ID.
 * @returns {Promise<object>} The deleted InventoryItems record.
 */
export const deleteInventoryItem = async (id) => {
  try {
    const deleted = await prisma.inventoryItems.delete({
      where: { id },
      include: {
        item: true,
        location: true,
      },
    });
    return deleted;
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    throw new Error("Failed to delete inventory item.");
  }
};

/**
 * Retrieves all inventory items for a given inventoryId, grouped by rack.
 * @param {number} inventoryId - The ID of the inventory (store).
 * @returns {Promise<object>} Items grouped by rack.
 */
export const getInventoryItemsByRack = async (inventoryId) => {
  try {
    const inventoryItems = await prisma.inventoryItems.findMany({
      where: { inventoryId },
      include: {
        item: {
          include: {
            category: true,
            color: true,
          },
        },
        location: true,
      },
    });

    if (!inventoryItems.length) return null;

    // Group items by rack
    const groupedByRack = inventoryItems.reduce((acc, invItem) => {
      const rack = invItem.location?.rack || "Unassigned";
      if (!acc[rack]) acc[rack] = [];
      acc[rack].push(invItem);
      return acc;
    }, {});

    return groupedByRack;
  } catch (error) {
    console.error("Error fetching inventory items by rack:", error);
    throw new Error("Failed to fetch inventory items by rack.");
  }
};
