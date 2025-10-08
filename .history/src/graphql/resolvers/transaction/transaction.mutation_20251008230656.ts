import {
  extendType,
  nonNull,
  intArg,
  stringArg,
  list,
  arg,
  enumType,
  inputObjectType,
  objectType,
} from "nexus";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";
import * as transactionService from "../../../services/transaction.service.js";

export const CartItemInput = inputObjectType({
  name: "CartItemInput",
  definition(t) {
    t.nonNull.int("itemId"); // the ID of the item being sold
    t.nonNull.int("quantity"); // how many were sold
    t.nonNull.float("price"); // unit price
  },
});
export const PaymentInitiation = objectType({
  name: "PaymentInitiation",
  definition(t) {
    t.nonNull.string("url"),
      t.nonNull.string("return_url"),
      t.nonNull.string("public_key");
  },
});
export const TransactionMutation = extendType({
  type: "Mutation",
  definition(t) {
    // Create a transaction
    t.field("createTransaction", {
      type: "Transaction",
      args: {
        outletId: nonNull(intArg()),
        cashierId: nonNull(intArg()),
        total: nonNull(arg({ type: "Float" })),
        subtotal: nonNull(arg({ type: "Float" })),
        vatAmount: nonNull(arg({ type: "Float" })),
        cashReceived: arg({ type: "Float" }),
        change: arg({ type: "Float" }),
        paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
        paymentType: stringArg(),
        status: nonNull(arg({ type: "Status" })),
        createdAt: nonNull(stringArg()),
        itemsSold: nonNull(list(nonNull(arg({ type: CartItemInput })))),
      },
      async resolve(_, args, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);

        const { itemsSold, ...transactionData } = args;

        if (!itemsSold || itemsSold.length === 0) {
          throw new Error("Missing itemsSold array.");
        }

        try {
          return await transactionService.processTransaction(
            transactionData,
            itemsSold
          );
        } catch (error) {
          console.error("Error processing transaction:", error);
          if (error.message.includes("Insufficient stock")) {
            throw new Error(error.message);
          }
          throw new Error("Failed to process transaction.");
        }
      },
    });
    t.field("initiatePayment", {
      type: "PaymentInitiation", // custom type with url field
      args: {
        outletId: nonNull(intArg()),
        cashierId: nonNull(intArg()),
        total: nonNull(arg({ type: "Float" })),
        subtotal: nonNull(arg({ type: "Float" })),
        vatAmount: nonNull(arg({ type: "Float" })),
        paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
        paymentType: stringArg(),
        paymentDetails: nonNull(arg({ type: "PaymentDetails" })),
        status: nonNull(arg({ type: "Status" })),
        itemsSold: nonNull(list(nonNull(arg({ type: CartItemInput })))),
      },
      resolve: async (_, transactionData, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
        const fullTransactionData = {
          ...transactionData,
          createdAt: new Date().toISOString(),
        };
        try {
          return await transactionService.initiatePayment(fullTransactionData);
        } catch (error) {
          console.error(
            `Error upon making transaction through ${transactionData.paymentType}`
          );
          throw new Error(
            `Error upon making transaction through ${transactionData.paymentType}`
          );
        }
      },
    });
  },
});
