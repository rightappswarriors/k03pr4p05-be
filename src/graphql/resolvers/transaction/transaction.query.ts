import { extendType, nonNull, intArg, stringArg, list, arg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as transactionService from "../../../services/transaction.service.js";

export const TransactionQuery = extendType({
  type: "Query",
  definition(t) {
    // Get transactions by outletId (with optional date range)
    t.nonNull.list.nonNull.field("getTransactionsByStoreId", {
      type: "Transaction",
      args: {
        outletId: nonNull(intArg()),
        startDate: stringArg(), // optional
        endDate: stringArg(),   // optional
      },
      async resolve(_, { outletId, startDate, endDate }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER"]);

        try {
          return await transactionService.getTransactionsByOutletId(
            outletId,
            startDate,
            endDate
          );
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error retrieving transactions:", error);
          throw new Error("Failed to fetch transactions.");
        }
      },
    });
  },
});

