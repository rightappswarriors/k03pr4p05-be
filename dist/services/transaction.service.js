import { prisma } from '../lib/prisma.js';
import { decrypt } from "../lib/encrypt.js";
import * as paymongoService from "./paymongo.service.js";
import { sendToUser } from "../lib/ws.js";
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
        if (process.env.NODE_ENV === "development")
            console.log("Inventory Id:", inventory.id);
        if (!inventory) {
            throw new Error(`No inventory found for outlet ID: ${transactionData.outletId}`);
        }
        for (const item of itemsSold) {
            // Find the specific InventoryItems record for this item and store.
            if (process.env.NODE_ENV === "development")
                console.log("Inventory Id:", inventory.id);
            if (process.env.NODE_ENV === "development")
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
                throw new Error(`No inventory item found for item ID: ${item.itemId} in inventory ID: ${inventory.id}`);
            }
            if (process.env.NODE_ENV === "development")
                console.log("InventoryItems Id:", inventoryItem.id);
            //if (!inventoryItem || inventoryItem.quantity < item.quantity) {
            //  throw new Error(`Insufficient stock for item ID: ${item.itemId}`);
            //}
            // Decrement the quantity.
            if (process.env.NODE_ENV === "development")
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
        const manager = await tx.outlet.findUnique({
            where: {
                id: Number(transactionData.outletId)
            },
            select: {
                id: true,
                ownerId: true,
                branchId: true
            }
        });
        sendToUser(manager?.ownerId, {
            type: "NEW_TRANSACTION",
            payload: {
                outletId: manager.id,
                branchId: manager.branchId,
                cashierId: transactionData.cahierId ?? "",
                items: transactionData.orderItem ?? [],
                subtotal: transactionData.subtotal ?? 0,
                paymentMethod: transactionData.method,
                total: transactionData.total,
            }
        });
        if (process.env.NODE_ENV === "development")
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
 */ export const getTransactionsByOutletId = async (outletId, startDate, endDate) => {
    const where = {
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
export const finalizeTransaction = async (transactionDatas, itemsSold) => {
    return prisma.$transaction(async (tx) => {
        // 1. Deduct items from the inventory.
        // We'll iterate through each item and decrement the quantity.
        if (process.env.NODE_ENV === "development")
            console.log("Transaction data", transactionDatas);
        const inventory = await tx.inventory.findUnique({
            where: {
                outletId: transactionDatas.transactionData.outletId,
            },
            select: {
                id: true,
            },
        });
        if (process.env.NODE_ENV === "development")
            console.log("Inventory Id:", inventory.id);
        if (!inventory) {
            throw new Error(`No inventory found for outlet ID: ${transactionDatas.transactionData.outletId}`);
        }
        for (const item of itemsSold) {
            // Find the specific InventoryItems record for this item and store.
            if (process.env.NODE_ENV === "development")
                console.log("Inventory Id:", inventory.id);
            if (process.env.NODE_ENV === "development")
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
                throw new Error(`No inventory item found for item ID: ${item.itemId} in inventory ID: ${inventory.id}`);
            }
            if (process.env.NODE_ENV === "development")
                console.log("InventoryItems Id:", inventoryItem.id);
            //if (!inventoryItem || inventoryItem.quantity < item.quantity) {
            //  throw new Error(`Insufficient stock for item ID: ${item.itemId}`);
            //}
            // Decrement the quantity.
            if (process.env.NODE_ENV === "development")
                console.log("InventoryItems Id:", inventoryItem.id);
            if (!inventory) {
                throw new Error(`No Inventory Item found: ${item.id}`);
            } /*
            await tx.inventoryItems.update({
              where: {
                id: inventoryItem.id,
              },
              data: {
                quantity: {
                  decrement: item.quantity,
                },
              },
            });*/
        }
        const status = transactionDatas.transactionData.customerDetails.status === "succeeded" ? "PAID" : "FAILED";
        // 2. Create the transaction record.
        const { customerDetails, outletId, total, subtotal, vatAmount, paymentMethod, } = transactionDatas.transactionData;
        const newTransaction = await tx.transaction.create({
            data: {
                total,
                outletId,
                subtotal,
                vatAmount,
                paymentMethod,
                customerDetails: {
                    create: {
                        ...customerDetails
                    }
                },
                status: status,
                cashierId: transactionDatas.cashierId,
                createdAt: transactionDatas.createdAt,
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
        if (process.env.NODE_ENV === "development")
            console.log(newTransaction);
        return newTransaction;
    });
};
export const initiatePayment = async (transactionData) => {
    try {
        const outlet = await prisma.outlet.findUnique({
            where: {
                id: transactionData.outletId
            },
            select: {
                name: true,
                id: true,
                apiKeyId: true,
            }
        });
        if (!outlet) {
            throw new Error("Outlet not found");
        }
        const APIKEYS = await prisma.PaymongoAPIKeys.findUnique({
            where: {
                id: outlet.apiKeyId
            },
            select: {
                public_key: true,
                secret_key: true
            }
        });
        const secret_key = decrypt(APIKEYS.secret_key);
        const public_key = decrypt(APIKEYS.secret_key);
        const paymentMethodData = await paymongoService.createPaymentMethod({
            paymentType: transactionData.paymentType,
            secret_key,
            customerDetails: transactionData.customerDetails,
        });
        const description = `${outlet.name} - POS ${transactionData.paymentType} Payment (${new Date().toLocaleDateString()})`;
        const paymentIntentData = await paymongoService.createPaymentIntent(transactionData.total, description, secret_key);
        const attachPaymentIntent = await paymongoService.attachPaymentIntent(paymentIntentData.data.id, // Payment Intent Id : pi_M4pRMcK1kEa2bHoLLq5bQmDD
        paymentMethodData.data.id, // Payment Method Id: pm_GkxdXASw7s1tsXF6XvUGzfLq
        paymentIntentData.data.attributes.client_key, // Client key: pi_M4pRMcK1kEa2bHoLLq5bQmDD_client_7QAKX73MwuRyTyLgb8GSLWEx
        secret_key);
        return {
            url: attachPaymentIntent.data.data.attributes.next_action.redirect.url,
            return_url: attachPaymentIntent.data.data.attributes.next_action.redirect.return_url,
            public_key,
            paymentIntentId: attachPaymentIntent.data.data.id,
            client_key: attachPaymentIntent.data.data.attributes.client_key,
            paymentMethodId: paymentMethodData.data.id,
        };
    }
    catch (error) {
        if (process.env.NODE_ENV === "development")
            console.error("Error initiating the transaction: async initiatePayment:", error);
    }
};
