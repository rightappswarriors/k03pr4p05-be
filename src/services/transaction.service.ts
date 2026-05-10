//transaction.service.ts
// this is how I would rewrite processTransaction to be more robust and handle inventory deductions, stock movements, and notifications all in one transaction. it also includes a new function for processing customer returns, which adds back to inventory if the item is resellable, and logs a stock movement either way.
// posterminal
import { prisma } from '../lib/prisma.js';

import { decrypt } from "../lib/encrypt.js";
import * as paymongoService from "./paymongo.service.js";
import { sendToUser } from "../lib/ws.js"
import * as notificationService from "./notification.service.js";

const SC_PWD_RATE = 0.2;
const BNPC_RATE = 0.05;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const isScPwdDiscount = (type?: string | null) =>
  type === "SENIOR_CITIZEN" || type === "PWD";

const isBnpcDiscount = (type?: string | null) =>
  type === "BNPC_SENIOR_CITIZEN" || type === "BNPC_PWD";

const getDiscountRate = (type?: string | null, customRate?: number | null) => {
  if (isScPwdDiscount(type)) return SC_PWD_RATE;
  if (isBnpcDiscount(type)) return BNPC_RATE;
  if (type === "CUSTOM") return Number(customRate ?? 0);
  return 0;
};

export const computeScPwdBreakdown = async (tx: any, transactionData: any, itemsSold: any[]) => {
  const discountType = transactionData.discountType ?? "NONE";
  const rate = getDiscountRate(discountType, transactionData.discountRate);
  const totalPax = Number(transactionData.totalPax || 0);
  const scPwdPax = Number(transactionData.scPwdPax || 0);
  const proportion =
    totalPax > 0 && scPwdPax > 0 ? Math.min(scPwdPax / totalPax, 1) : 1;

  if (discountType === "NONE" || rate <= 0) {
    const itemBreakdown = itemsSold.map((item) => {
      const originalPrice = Number(item.priceAtSale ?? item.price ?? 0);
      const quantity = Number(item.quantity ?? 0);
      return {
        ...item,
        discountType: "NONE",
        discountRate: 0,
        discountAmount: roundMoney(item.discountAmount ?? 0),
        originalPrice,
        vatExclusivePrice: originalPrice,
        finalPrice: originalPrice,
        lineTotal: roundMoney(originalPrice * quantity),
      };
    });
    return {
      itemBreakdown,
      discountRate: 0,
      discountAmount: 0,
      vatExemptSale: 0,
      vatAmount: roundMoney(transactionData.vatAmount ?? 0),
      netTotal: roundMoney(transactionData.total ?? 0),
    };
  }

  const itemIds = itemsSold
    .map((item) => Number(item.itemId))
    .filter((itemId) => Number.isFinite(itemId));
  const itemRecords = await tx.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, isBNPC: true, isVatExempt: true, vatExempt: true, vatRate: true },
  });
  const itemMeta = new Map<number, any>(itemRecords.map((item) => [item.id, item]));

  let discountAmount = 0;
  let vatExemptSale = 0;
  let vatAmount = 0;
  let netTotal = 0;

  const itemBreakdown = itemsSold.map((item) => {
    const originalPrice = Number(item.priceAtSale ?? item.price ?? 0);
    const quantity = Number(item.quantity ?? 0);
    const meta = itemMeta.get(Number(item.itemId));
    const vatRate = Number(meta?.vatRate ?? 0.12);
    const itemIsVatExempt = Boolean(meta?.isVatExempt || meta?.vatExempt);
    const eligible = isScPwdDiscount(discountType) || (isBnpcDiscount(discountType) && meta?.isBNPC);
    const eligibleQty = quantity * proportion;
    const regularQty = quantity - eligibleQty;

    if (!eligible) {
      const lineVat = itemIsVatExempt ? 0 : originalPrice - originalPrice / (1 + vatRate);
      vatAmount += lineVat * quantity;
      netTotal += originalPrice * quantity;
      return {
        ...item,
        discountType: "NONE",
        discountRate: 0,
        discountAmount: 0,
        originalPrice,
        vatExclusivePrice: itemIsVatExempt ? originalPrice : roundMoney(originalPrice / (1 + vatRate)),
        finalPrice: originalPrice,
        lineTotal: roundMoney(originalPrice * quantity),
      };
    }

    if (isBnpcDiscount(discountType)) {
      const lineDiscount = originalPrice * rate * eligibleQty;
      const lineVat = itemIsVatExempt ? 0 : originalPrice - originalPrice / (1 + vatRate);
      const lineTotal = originalPrice * regularQty + (originalPrice - originalPrice * rate) * eligibleQty;
      discountAmount += lineDiscount;
      vatAmount += lineVat * quantity;
      netTotal += lineTotal;
      return {
        ...item,
        discountType,
        discountRate: rate,
        discountAmount: roundMoney(lineDiscount),
        originalPrice,
        vatExclusivePrice: itemIsVatExempt ? originalPrice : roundMoney(originalPrice / (1 + vatRate)),
        finalPrice: roundMoney(originalPrice * (1 - rate)),
        lineTotal: roundMoney(lineTotal),
      };
    }

    const vatExclusivePrice = itemIsVatExempt ? originalPrice : originalPrice / (1 + vatRate);
    const vatRemoved = itemIsVatExempt ? 0 : originalPrice - vatExclusivePrice;
    const lineDiscount = vatExclusivePrice * rate * eligibleQty;
    const discountedUnit = vatExclusivePrice * (1 - rate);
    const lineTotal = originalPrice * regularQty + discountedUnit * eligibleQty;

    discountAmount += lineDiscount;
    vatExemptSale += vatExclusivePrice * eligibleQty;
    vatAmount += vatRemoved * regularQty;
    netTotal += lineTotal;

    return {
      ...item,
      discountType,
      discountRate: rate,
      discountAmount: roundMoney(lineDiscount),
      originalPrice,
      vatExclusivePrice: roundMoney(vatExclusivePrice),
      finalPrice: roundMoney(discountedUnit),
      lineTotal: roundMoney(lineTotal),
    };
  });

  return {
    itemBreakdown,
    discountRate: rate,
    discountAmount: roundMoney(discountAmount),
    vatExemptSale: roundMoney(vatExemptSale),
    vatAmount: roundMoney(vatAmount),
    netTotal: roundMoney(netTotal),
  };
};
/**
 * @description
 * Processes a new transaction by creating a transaction record, creating
 * associated cart items, and deducting the sold items from the inventory.
 * All operations are wrapped in a single Prisma transaction for atomicity.
 *
 * @param {object} transactionData - The transaction details (storeId, cashierId, total, etc.).
 * @param {array} itemsSold - An array of items sold, each with itemId and quantity.
 * @returns {Promise<object>} The newly created transaction record.
 */// transaction.service.ts — full rewrite of processTransaction
export const processTransaction = async (transactionData: any, itemsSold: any) => {
  return prisma.$transaction(async (tx) => {
    const { scPwdCustomerInput, ...baseTransactionData } = transactionData;
    transactionData = {
      ...baseTransactionData,
      discountType: baseTransactionData.discountType ?? "NONE",
      customerType: baseTransactionData.customerType ?? "REGULAR",
      discountRate: baseTransactionData.discountRate ?? 0,
      discountAmount: baseTransactionData.discountAmount ?? 0,
      vatExemptSale: baseTransactionData.vatExemptSale ?? 0,
    };

    const discountBreakdown = await computeScPwdBreakdown(tx, transactionData, itemsSold);
    itemsSold = discountBreakdown.itemBreakdown;
    transactionData = {
      ...transactionData,
      total: discountBreakdown.netTotal,
      vatAmount: discountBreakdown.vatAmount,
      discountRate: discountBreakdown.discountRate,
      discountAmount: discountBreakdown.discountAmount,
      scPwdDiscountAmt: isScPwdDiscount(transactionData.discountType)
        ? discountBreakdown.discountAmount
        : transactionData.scPwdDiscountAmt,
      vatExemptAmount: discountBreakdown.vatExemptSale,
      vatExemptSale: discountBreakdown.vatExemptSale,
      isVatExempt: isScPwdDiscount(transactionData.discountType) || Boolean(transactionData.isVatExempt),
    };

    if (scPwdCustomerInput && transactionData.customerType !== "REGULAR") {
      const orgId = Number(transactionData.orgId || 0) || undefined;
      const customerData = {
        orgId,
        fullName: scPwdCustomerInput.fullName,
        idNumber: scPwdCustomerInput.idNumber,
        idType: scPwdCustomerInput.idType,
        customerType: scPwdCustomerInput.customerType ?? transactionData.customerType,
        dateOfBirth: scPwdCustomerInput.dateOfBirth ? new Date(scPwdCustomerInput.dateOfBirth) : null,
        contactNumber: scPwdCustomerInput.contactNumber ?? null,
        address: scPwdCustomerInput.address ?? null,
        isRepresentative: scPwdCustomerInput.isRepresentative ?? false,
        representativeName: scPwdCustomerInput.representativeName ?? null,
        representativeIdNumber: scPwdCustomerInput.representativeIdNumber ?? null,
      };

      const customer = scPwdCustomerInput.id
        ? await tx.scPwdCustomer.update({ where: { id: scPwdCustomerInput.id }, data: customerData })
        : await tx.scPwdCustomer.create({ data: customerData });

      transactionData.scPwdCustomerId = customer.id;
      transactionData.vatExemptRefNo = transactionData.vatExemptRefNo ?? customer.idNumber;
    }

    delete transactionData.orgId;

    // 1 — Find outlet inventory
    const inventory = await tx.inventory.findUnique({
      where: { outletId: transactionData.outletId },
      select: { id: true },
    });
    if (!inventory) {
      throw new Error(`No inventory found for outlet ID: ${transactionData.outletId}`);
    }

    // 2 — Process each sold item
    for (const item of itemsSold) {
      // Find inventory item at this outlet
      const inventoryItem = await tx.inventoryItems.findUnique({
        where: {
          inventoryId_itemId: {
            inventoryId: inventory.id,
            itemId: item.itemId,
          },
        },
        select: { id: true, quantity: true },
      });

      if (!inventoryItem) {
        throw new Error(
          `Item ID ${item.itemId} not found in outlet inventory`
        );
      }

      // Get conversionFactor from unit if unitId provided
      let conversionFactor = 1;
      if (item.unitId) {
        const unit = await tx.inventoryItemUnit.findUnique({
          where: { id: item.unitId },
          select: { conversionFactor: true },
        });
        if (unit) conversionFactor = unit.conversionFactor;
      }

      // Base units to deduct (e.g. 2 sacks × 50 kg/sack = 100 kg)
      const baseUnitsToDeduct = item.quantity * conversionFactor;
      const quantityBefore = inventoryItem.quantity;
      const quantityAfter = quantityBefore - baseUnitsToDeduct;

      // 3 — Deduct from outlet inventory
      await tx.inventoryItems.update({
        where: { id: inventoryItem.id },
        data: { quantity: { decrement: baseUnitsToDeduct } },
      });

      // 4 — Deduct from org-level Item.stock
      const outletWithOrg = await tx.outlet.findUnique({
        where: { id: transactionData.outletId },
        select: { orgId: true, ownerId: true },
      });
      if (!outletWithOrg) {
        throw new Error(`Outlet not found: ${transactionData.outletId}`);
      }
      await tx.item.update({
        where: { id: item.itemId },
        data: { stock: { decrement: baseUnitsToDeduct } },
      });

      // 5 — Log StockMovement
      await tx.stockMovement.create({
        data: {
          itemId: item.itemId,
          inventoryItemId: inventoryItem.id,
          outletId: transactionData.outletId,
          type: 'SALE',
          quantity: baseUnitsToDeduct,
          quantityBefore,
          quantityAfter,
          referenceType: 'TRANSACTION',
          // referenceId filled after transaction created below
          createdBy: transactionData.cashierId,
        },
      });

      // 6 — Check reorder point
      if (item.unitId) {
        const unit = await tx.inventoryItemUnit.findUnique({
          where: { id: item.unitId },
          select: { reorderPoint: true, unitName: true, unitLabel: true },
        });

        if (unit?.reorderPoint && quantityAfter <= unit.reorderPoint) {
          const itemDetails = await tx.item.findUnique({
            where: { id: item.itemId },
            select: { name: true },
          });

          // Fire and forget — don't await, don't block transaction
          notificationService.createNotification({
            orgId: outletWithOrg.orgId,
            outletId: transactionData.outletId,
            itemId: item.itemId,
            type: "OUTLET_LOW_STOCK",
            title: "Low Stock Alert",
            message: `${itemDetails?.name} at outlet is running low — ${quantityAfter.toFixed(2)} ${unit.unitName} remaining (reorder at ${unit.reorderPoint} ${unit.unitName})`,
            notifyUserId: outletWithOrg.ownerId,
          }).catch(() => { }); // silent fail — don't break transaction
        }
      }

      // 7 — Check org-level minQuantity
      const updatedItem = await tx.item.findUnique({
        where: { id: item.itemId },
        select: { stock: true, minQuantity: true, name: true },
      });

      if (updatedItem && updatedItem.stock <= updatedItem.minQuantity) {
        notificationService.createNotification({
          orgId: outletWithOrg.orgId,
          itemId: item.itemId,
          type: "ORG_CRITICAL_STOCK",
          title: "Critical Stock Alert",
          message: `Total stock of ${updatedItem.name} is critically low — ${updatedItem.stock} remaining (minimum: ${updatedItem.minQuantity})`,
          notifyUserId: outletWithOrg.ownerId,
        }).catch(() => { });
      }
    }

    // 8 — Create transaction record
    const newTransaction = await tx.transaction.create({
      data: {
        ...transactionData,
        items: {
          createMany: {
            data: itemsSold.map((item: any) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              priceAtSale: item.priceAtSale ?? item.price,
              unitId: item.unitId ?? null,
              unitName: item.unitName ?? null,
              discountAmount: item.discountAmount ?? null,
              discountQuantity: item.discountQuantity ?? null,  // ← NEW
              discountRate: item.discountRate ?? null,          // ← NEW
              discountType: item.discountType ?? transactionData.discountType ?? "NONE",
              originalPrice: item.originalPrice ?? item.priceAtSale ?? item.price,
              vatExclusivePrice: item.vatExclusivePrice ?? item.priceAtSale ?? item.price,
              finalPrice: item.finalPrice ?? item.priceAtSale ?? item.price,
            })),
          },
        },
      },
      include: { items: true, scPwdCustomer: true },
    });

    // 9 — Update StockMovement referenceId now that we have the transaction id
    await tx.stockMovement.updateMany({
      where: {
        outletId: transactionData.outletId,
        referenceType: 'TRANSACTION',
        referenceId: null,
        createdBy: transactionData.cashierId,
      },
      data: { referenceId: newTransaction.id.toString() },
    });

    // 10 — Notify manager via websocket
    const manager = await tx.outlet.findUnique({
      where: { id: Number(transactionData.outletId) },
      select: { id: true, ownerId: true, branchId: true },
    });
    if (manager) {
      sendToUser(manager.ownerId, {
        type: 'NEW_TRANSACTION',
        payload: {
          outletId: manager.id,
          branchId: manager.branchId,
          cashierId: transactionData.cashierId,
          total: transactionData.total,
          paymentMethod: transactionData.paymentMethod,
        },
      });
    }

    return newTransaction;
  });
};

export const processCustomerReturn = async (data: {
  transactionId: number;
  outletId: number;
  items: Array<{
    itemId: number;
    quantity: number;
    unitId?: number;
    isResellable: boolean;
    reason?: string;
  }>;
  createdBy: number;
}) => {
  return prisma.$transaction(async (tx) => {
    // Verify transaction exists
    const transaction = await tx.transaction.findUnique({
      where: { id: data.transactionId },
      include: { items: true }
    });
    if (!transaction) throw new Error("Transaction not found");

    const inventory = await tx.inventory.findUnique({
      where: { outletId: data.outletId },
      select: { id: true }
    });
    if (!inventory) throw new Error("Outlet inventory not found");

    for (const returnItem of data.items) {
      // Get conversionFactor if unit provided
      let conversionFactor = 1;
      if (returnItem.unitId) {
        const unit = await tx.inventoryItemUnit.findUnique({
          where: { id: returnItem.unitId },
          select: { conversionFactor: true }
        });
        if (unit) conversionFactor = unit.conversionFactor;
      }

      const baseQty = returnItem.quantity * conversionFactor;

      const inventoryItem = await tx.inventoryItems.findUnique({
        where: {
          inventoryId_itemId: {
            inventoryId: inventory.id,
            itemId: returnItem.itemId,
          }
        },
        select: { id: true, quantity: true }
      });

      if (!inventoryItem) continue;

      const movementType = returnItem.isResellable
        ? 'CUSTOMER_RETURN'
        : 'WRITE_OFF';

      if (returnItem.isResellable) {
        // Add back to outlet inventory
        await tx.inventoryItems.update({
          where: { id: inventoryItem.id },
          data: { quantity: { increment: baseQty } }
        });

        // Add back to org stock
        await tx.item.update({
          where: { id: returnItem.itemId },
          data: { stock: { increment: baseQty } }
        });
      }

      // Log StockMovement either way
      await tx.stockMovement.create({
        data: {
          itemId: returnItem.itemId,
          inventoryItemId: inventoryItem.id,
          outletId: data.outletId,
          type: movementType,
          quantity: baseQty,
          quantityBefore: inventoryItem.quantity,
          quantityAfter: returnItem.isResellable
            ? inventoryItem.quantity + baseQty
            : inventoryItem.quantity,
          referenceId: String(data.transactionId),
          referenceType: 'TRANSACTION',
          reason: returnItem.reason ?? null,
          createdBy: data.createdBy,
        }
      });
    }

    return { success: true, transactionId: data.transactionId };
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
      scPwdCustomer: true,
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

/**
 * Retrieves a list of all transactions for all outlets of a specific organization.
 * @param {number} orgId - The ID of the organization.
 * @param {string} [startDate] - Optional start date for filtering (ISO 8601 string).
 * @param {string} [endDate] - Optional end date for filtering (ISO 8601 string).
 * @returns {Promise<object[]>} An array of transaction records.
 */
export const getTransactionsByOrgId = async (
  orgId: number,
  startDate?: string,
  endDate?: string
) => {
  const where: any = {
    outlet: {
      orgId,
    },
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
      scPwdCustomer: true,
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

export const getOutletTransactions = async (
  outletId: number,
  startDate?: Date,
  endDate?: Date,
  limit: number = 50,
  offset: number = 0,
) => {
  return await prisma.transaction.findMany({
    where: {
      outletId,
      ...(startDate && endDate && {
        createdAt: { gte: startDate, lte: endDate },
      }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      createdAt: true,
      total: true,
      status: true,
      subtotal: true,
      cashierId: true,
      outletId: true,
      vatAmount: true,
      syncedAt: true,
      change: true,
      
      paymentMethod: true,
      cashReceived: true,
      customerType: true,
      discountType: true,
      discountRate: true,
      discountAmount: true,
      vatExemptSale: true,
      totalPax: true,
      scPwdPax: true,
      scPwdCustomer: true,
      items: {
        select: {
          quantity: true,
          item: {
            select: {
              name: true,
              InventoryItems: {
                select: {
                  price: true,
                },
              },
            },
          },
        },
      },
      cashier: {
        select: {
          id: true,
          fullname: true,
          email: true,
          role: true,
        },
      },
    },
  });
};

export const getTransactionsByDiscountType = async (
  discountType: string,
  orgId?: number,
) => {
  return prisma.transaction.findMany({
    where: {
      discountType: discountType as any,
      ...(orgId ? { outlet: { orgId } } : {}),
    },
    include: {
      outlet: true,
      cashier: true,
      scPwdCustomer: true,
      items: { include: { item: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getBirDiscountLogbook = async (
  startDate?: string,
  endDate?: string,
  orgId?: number,
) => {
  const transactions = await prisma.transaction.findMany({
    where: {
      discountType: {
        in: ["SENIOR_CITIZEN", "PWD", "BNPC_SENIOR_CITIZEN", "BNPC_PWD"] as any[],
      },
      ...(orgId ? { outlet: { orgId } } : {}),
      ...(startDate || endDate
        ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
        : {}),
    },
    include: {
      scPwdCustomer: true,
      items: { include: { item: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return transactions.map((transaction) => ({
    date: transaction.createdAt,
    orNumber: String(transaction.id),
    fullName: transaction.scPwdCustomer?.fullName ?? "",
    idNumber: transaction.scPwdCustomer?.idNumber ?? transaction.vatExemptRefNo ?? "",
    itemsPurchased: transaction.items
      .map((line) => `${line.item?.name ?? `Item #${line.itemId}`} x ${line.quantity}`)
      .join(", "),
    totalBeforeDiscount: roundMoney(transaction.subtotal),
    discountAmount: roundMoney(transaction.discountAmount ?? 0),
    netAmountPaid: roundMoney(transaction.total),
    discountType: transaction.discountType,
  }));
};

export const finalizeTransaction = async (transactionDatas, itemsSold) => {
  return prisma.$transaction(async (tx) => {
    // 1. Deduct items from the inventory.
    // We'll iterate through each item and decrement the quantity.
    if (process.env.NODE_ENV === "development") console.log("Transaction data", transactionDatas)
    const inventory = await tx.inventory.findUnique({
      where: {
        outletId: transactionDatas.transactionData.outletId,
      },
      select: {
        id: true,
      },
    });
    if (process.env.NODE_ENV === "development") console.log("Inventory Id:", inventory.id);
    if (!inventory) {
      throw new Error(
        `No inventory found for outlet ID: ${transactionDatas.transactionData.outletId}`
      );
    }

    for (const item of itemsSold) {
      // Find the specific InventoryItems record for this item and store.
      if (process.env.NODE_ENV === "development") console.log("Inventory Id:", inventory.id);
      if (process.env.NODE_ENV === "development") console.log("Item:", item.itemId);
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

      if (process.env.NODE_ENV === "development") console.log("InventoryItems Id:", inventoryItem.id);

      //if (!inventoryItem || inventoryItem.quantity < item.quantity) {
      //  throw new Error(`Insufficient stock for item ID: ${item.itemId}`);
      //}

      // Decrement the quantity.
      if (process.env.NODE_ENV === "development") console.log("InventoryItems Id:", inventoryItem.id);
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
    const status =
      transactionDatas.transactionData.customerDetails.status === "succeeded" ? "PAID" : "FAILED";
    // 2. Create the transaction record.

    const { customerDetails, outletId, total, subtotal, vatAmount, paymentMethod, } = transactionDatas.transactionData
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
    if (process.env.NODE_ENV === "development") console.log(newTransaction);
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
    })
    if (!outlet) {
      throw new Error("Outlet not found")
    }
    const APIKEYS = await prisma.paymongoAPIKeys.findUnique({
      where: {
        id: outlet.apiKeyId
      },
      select: {
        public_key: true,
        secret_key: true
      }
    })
    const secret_key = decrypt(
      APIKEYS.secret_key
    );
    const public_key = decrypt(
      APIKEYS.secret_key
    );
    const paymentMethodData = await paymongoService.createPaymentMethod({
      paymentType: transactionData.paymentType,
      secret_key,
      customerDetails: transactionData.customerDetails,
    });

    const description = `${outlet.name} - POS ${transactionData.paymentType
      } Payment (${new Date().toLocaleDateString()})`;

    const paymentIntentData = await paymongoService.createPaymentIntent(
      transactionData.total,
      description,
      secret_key
    );
    const attachPaymentIntent = await paymongoService.attachPaymentIntent(
      paymentIntentData.data.id, // Payment Intent Id : pi_M4pRMcK1kEa2bHoLLq5bQmDD
      paymentMethodData.data.id, // Payment Method Id: pm_GkxdXASw7s1tsXF6XvUGzfLq
      paymentIntentData.data.attributes.client_key, // Client key: pi_M4pRMcK1kEa2bHoLLq5bQmDD_client_7QAKX73MwuRyTyLgb8GSLWEx
      secret_key
    );

    return {
      url: attachPaymentIntent.data.data.attributes.next_action.redirect.url,
      return_url:
        attachPaymentIntent.data.data.attributes.next_action.redirect.return_url,
      public_key,
      paymentIntentId: attachPaymentIntent.data.data.id,
      client_key: attachPaymentIntent.data.data.attributes.client_key,
      paymentMethodId: paymentMethodData.data.id,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error(
      "Error initiating the transaction: async initiatePayment:",
      error
    );
  }
};
