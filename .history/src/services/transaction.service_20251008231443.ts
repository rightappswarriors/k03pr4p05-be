import { PrismaClient } from "@prisma/client";
import { decrypt } from "../lib/encrypt";
import * as paymongoService from "./paymongo.service.js";

const prisma = new PrismaClient();

/**
 * @description
 * Processes a new transaction by creating a transaction record, creating
 * associated cart items, and deducting the sold items from the inventory.
 * All operations are wrapped in a single Prisma transaction for atomicity.
 *
 * @param {object} transactionData - The transaction details (storeId, cashierId, total, etc.).
 * @param {array} itemsSold - An array of items sold, each with itemId and quantity.
 * @returns {Promise<object>} The newly created transaction record.
 */
export const processTransaction = async (transactionData, itemsSold) => {
  // Use a transaction to ensure all database operations succeed or fail together.
  return prisma.$transaction(async (tx) => {
    // 1. Deduct items from the inventory.
    // We'll iterate through each item and decrement the quantity.
    const inventory = await tx.inventory.findUnique({
      where: {
        outletId: transactionData.outletId,
      },
      select: {
        id: true,
      },
    });
    console.log("Inventory Id:", inventory.id);
    if (!inventory) {
      throw new Error(
        `No inventory found for outlet ID: ${transactionData.outletId}`
      );
    }

    for (const item of itemsSold) {
      // Find the specific InventoryItems record for this item and store.
      console.log("Inventory Id:", inventory.id);
      console.log("Item:", item.itemId);
      const inventoryItem = await tx.inventoryItems.findUnique({
        where: {
          inventoryId_itemId: {
            inventoryId: inventory.id,
            itemId: item.itemId,
          },
        },
        select: {
          id: true,
          quantity: true,
        },
      });
      if (!inventoryItem) {
        throw new Error(
          `No inventory item found for item ID: ${item.itemId} in inventory ID: ${inventory.id}`
        );
      }

      console.log("InventoryItems Id:", inventoryItem.id);

      //if (!inventoryItem || inventoryItem.quantity < item.quantity) {
      //  throw new Error(`Insufficient stock for item ID: ${item.itemId}`);
      //}

      // Decrement the quantity.
      console.log("InventoryItems Id:", inventoryItem.id);
      if (!inventory) {
        throw new Error(`No Inventory Item found: ${item.id}`);
      }
      await tx.inventoryItems.update({
        where: {
          id: inventoryItem.id,
        },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    // 2. Create the transaction record.
    const newTransaction = await tx.transaction.create({
      data: {
        ...transactionData,
        // Create the CartItem records and link them to the transaction.
        items: {
          createMany: {
            data: itemsSold.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          },
        },
      },
      include: {
        items: true, // Include the CartItems in the response
      },
    });
    console.log(newTransaction);
    return newTransaction;
  });
};
/**
 * @description
 * Retrieves a list of all transactions for a specific store.
 * @param {number} storeId - The ID of the store.
 * @param {string} [startDate] - Optional start date for filtering (ISO 8601 string).
 * @param {string} [endDate] - Optional end date for filtering (ISO 8601 string).
 * @returns {Promise<object[]>} An array of transaction records.
 */ export const getTransactionsByOutletId = async (
  outletId: number,
  startDate?: string,
  endDate?: string
) => {
  const where: any = {
    outletId,
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      outlet: true,
      cashier: true,
      items: {
        include: {
          item: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return transactions;
};

export const initiatePayment = async (transactionData) => {
  const outletOwner = await prisma.outlet.findUnique({
    where: { id: transactionData.outletId },
    select: {
      name: true,
      branch: {
        select: {
          owner: {
            select: {
              paymongoAPIKeys: {
                select: {
                  secret_key: true,
                  public_key: true
                },
              },
            },
          },
        },
      },
    },
  });
  const secret_key = decrypt(
    outletOwner.branch.owner.paymongoAPIKeys.secret_key
  );
  const public_key = decrypt(
    outletOwner.branch.owner.paymongoAPIKeys.secret_key
  );
  const paymentMethodData = await paymongoService.createPaymentMethod({
    paymentType: transactionData.paymentType,
    secret_key,
  });

  const description = `${outletOwner.name} - POS ${
    transactionData.paymentType
  } Payment (${new Date().toLocaleDateString()})`;

  const paymentIntentData = await paymongoService.createPaymentIntent(
    transactionData.total,
    description,
    secret_key
  );

  const attachPaymentIntent = await paymongoService.attachPaymentIntent(
    paymentIntentData.id,
    paymentMethodData.id,
    paymentIntentData.attributes.client_key,
    secret_key
  );
  return {
    url: attachPaymentIntent.attributes.next_action.redirect.url,
    return_url: attachPaymentIntent.attributes.next_action.redirect.return_url,
    public_key: public_key,
  };
};
