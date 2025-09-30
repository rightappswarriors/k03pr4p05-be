import { extendType, nonNull, intArg, stringArg, list, arg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as transactionService from "../../../services/transaction.service.js";

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
        tax: nonNull(arg({ type: "Float" })),
        cashReceived: arg({ type: "Float" }),
        change: arg({ type: "Float" }),
        paymentMethod: nonNull(arg({ type: "PaymentMethod" })),
        status: nonNull(arg({ type: "Status" })),
        itemsSold: nonNull(list(nonNull(arg({ type: "CartItemInput" })))),
      },
      async resolve(_, args, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER"]);

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
  },
});
