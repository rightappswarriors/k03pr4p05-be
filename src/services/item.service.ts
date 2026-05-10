// rai-pos-backend\src\services\item.service.ts

import { prisma } from '../lib/prisma.js';


interface CostLineInput {
  label: string;
  amount: number;
}

interface CreateItemInput {
  orgId: number;
  name: string;
  barcode: string;
  stock?: number | null;
  brand?: string | null;
  description?: string | null;
  sellingPrice: number;
  image?: string | null;
  costLines?: CostLineInput[];
  categoryId?: number | null;
  brandId?: number | null;
  itemCode?: string | null;
  skuNumber?: string | null;
  vatExempt?: boolean | null;
  isVatExempt?: boolean | null;
  isBNPC?: boolean | null;
  vatRate?: number | null;
  ServiceCharge?: boolean | null;
  assembly?: boolean | null;
  minQuantity?: number | null;
  opExPct?: number;
  priceB?: number | null;
  priceC?: number | null;
  stockLabel?: string | null;
  stockDescription?: string | null;
  vatTypeId?: number | null;
}

interface UpdateItemInput {
  name?: string | null;
  image?: string | null;
  description?: string | null;
  barcode?: string | null;
  brand?: string | null;
  sellingPrice: number; // nonNull in schema — always required
  costLines?: CostLineInput[];
  brandId?: number | null;
  itemCode?: string | null;
  categoryId?: number | null;
  stock?: number | null;
  priceB?: number | null;
  priceC?: number | null;
  opExPct?: number | null;
  minQuantity?: number | null;
  vatExempt?: boolean | null;
  isVatExempt?: boolean | null;
  isBNPC?: boolean | null;
  vatRate?: number | null;
  ServiceCharge?: boolean | null;
  assembly?: boolean | null;
  skuNumber?: string | null;
  stockLabel?: string | null;
  stockDescription?: string | null;
  vatTypeId?: number | null;
}

interface InventoryItemUpdateInput {
  quantity?: number | null;
  price?: number | null;
  name?: string | null;
  locationData?: { aisle?: string; rack?: string; shelf?: string } | null;
  itemData?: { id: number } | null;
}
// Your existing service functions...

/**
 * Inserts multiple new items into the database in a single, efficient query.
 * @param {Array<object>} data - An array of item objects to create.
 * @returns {Promise<int>} An object containing the count of created items.
 */
// Add/replace in your item.service.ts

// Called by the createItems mutation.
// Returns the count of created rows — the mutation returns { count }.
export const bulkCreateItems = async (
  items: Array<{
    orgId: number;
    name: string;
    barcode: string;
    stock?: number | null;
    brand?: string | null;
    description?: string | null;
    sellingPrice: number;
    costLines?: { label: string; amount: number }[];
    image?: string | null;
    categoryId?: number | null;
    orgCategoryId?: number | null;      // ✅ add
    brandId?: number | null;
    itemCode?: string | null;
    skuNumber?: string | null;
    vatExempt?: boolean | null;
    isVatExempt?: boolean | null;
    isBNPC?: boolean | null;
    vatRate?: number | null;
    ServiceCharge?: boolean | null;
    assembly?: boolean | null;
    minQuantity?: number | null;
    opExPct?: number | null;
    priceB?: number | null;
    priceC?: number | null;
    vatTypeId?: number | null;          // ✅ optional
    stockDescription?: string | null;
    stockLabel?: string
  }>
) => {
  const result = await prisma.$transaction(
    items.map((item) => {
      const itemTotalCost =
        item.costLines?.reduce((sum, line) => sum + line.amount, 0) || 0;

      return prisma.item.create({
        data: {
          org: { connect: { id: item.orgId } },
          name: item.name,
          barcode: item.barcode,
          stock: item.stock ?? 0,
          brand: item.brand ?? null,
          sellingPrice: item.sellingPrice,
          minQuantity: item.minQuantity ?? 0,
          priceB: item.priceB ?? null,
          priceC: item.priceC ?? null,
          totalCost: itemTotalCost,
          opExPct: item.opExPct ?? 0.1,
          ...(item.vatTypeId ? { vatType: { connect: { id: item.vatTypeId } } } : {}),
          stockLabel: item.stockLabel ?? 'piece',
          stockDescription: item.stockDescription ?? null,
          costLines: item.costLines?.length
            ? {
              create: item.costLines.map((line) => ({
                label: line.label,
                amount: line.amount,
              })),
            }
            : undefined,
          description: item.description ?? null,
          image: item.image ?? null,
          ...(item.categoryId ? { category: { connect: { id: item.categoryId } } } : {}),
          ...(item.orgCategoryId ? { orgCategory: { connect: { id: item.orgCategoryId } } } : {}),
          ...(item.brandId ? { brandDetails: { connect: { id: item.brandId } } } : {}),
          itemCode: item.itemCode ?? null,
          skuNumber: item.skuNumber ?? null,
          vatExempt: item.vatExempt ?? false,
          isVatExempt: item.isVatExempt ?? item.vatExempt ?? false,
          isBNPC: item.isBNPC ?? false,
          vatRate: item.vatRate ?? 0.12,
          ServiceCharge: item.ServiceCharge ?? false,
          assembly: item.assembly ?? false,
        },
      });
    })
  );
  return result.length;
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
    if (process.env.NODE_ENV === "development") console.error("Error updating inventory item:", error);
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
    if (process.env.NODE_ENV === "development") console.error("Error deleting inventory item:", error);
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
    if (process.env.NODE_ENV === "development") console.error("Error fetching inventory items by rack:", error);
    throw new Error("Failed to fetch inventory items by rack.");
  }
};
export const getItemById = async (id) => {
  return prisma.item.findUnique({
    where: { id: id }
  })
}

/**
 * Updates a single Item by id.
 * Replaces all costLines in one transaction (deleteMany + create).
 * totalCost is recalculated from the incoming costLines when provided.
 */
export const updateItem = async (id: number, data: UpdateItemInput) => {
  // Only recalculate totalCost when costLines are explicitly provided
  const totalCost =
    data.costLines != null
      ? data.costLines.reduce((sum, line) => sum + line.amount, 0)
      : undefined;

  return prisma.item.update({
    where: { id },
    data: {
      // Spread scalar fields — Prisma ignores undefined values
      name: data.name ?? undefined,
      image: data.image ?? undefined,
      description: data.description ?? undefined,
      barcode: data.barcode ?? undefined,
      brand: data.brand ?? undefined,
      sellingPrice: data.sellingPrice,
      brandId: data.brandId ?? undefined,
      itemCode: data.itemCode ?? undefined,
      categoryId: data.categoryId ?? undefined,
      stock: data.stock ?? undefined,
      priceB: data.priceB ?? undefined,
      priceC: data.priceC ?? undefined,
      opExPct: data.opExPct ?? undefined,
      minQuantity: data.minQuantity ?? undefined,
      vatExempt: data.vatExempt ?? undefined,
      isVatExempt: data.isVatExempt ?? undefined,
      isBNPC: data.isBNPC ?? undefined,
      vatRate: data.vatRate ?? undefined,
      ServiceCharge: data.ServiceCharge ?? undefined,
      assembly: data.assembly ?? undefined,
      skuNumber: data.skuNumber ?? undefined,
      stockLabel: data.stockLabel ?? undefined,
      stockDescription: data.stockDescription ?? undefined,
      // Only touch totalCost / costLines when caller provided costLines
      ...(totalCost !== undefined && { totalCost }),
      ...(data.costLines != null && {
        costLines: {
          deleteMany: {}, // wipe existing lines
          create: data.costLines.map((line: { label: string, amount: number }) => ({
            label: line.label,
            amount: line.amount,
          })),
        },
      }),
    },
    include: {
      category: true,
      brandDetails: true,
      costLines: true,
      media: { orderBy: { sortOrder: "asc" } },
    },
  });
};

export const deleteItem = async (id) => {
  return prisma.item.delete({
    where: { id: id }
  })
}
export const getItems = async (query, size, orderBy) => {

  return prisma.item.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : {},
    take: size,
    orderBy: { name: orderBy }
  })

}
