import { extendType, nonNull, intArg, stringArg, list, arg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as transactionService from "../../../services/transaction.service.js";

export const TransactionQuery = extendType({
  type: "Query",
  definition(t) {
    // Get transactions by storeId (with optional date range)
    t.nonNull.list.nonNull.field("getTransactionsByStoreId", {
      type: "Transaction",
      args: {
        storeId: nonNull(intArg()),
        startDate: stringArg(), // optional
        endDate: stringArg(),   // optional
      },
      async resolve(_, { storeId, startDate, endDate }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER"]);

        try {
          return await transactionService.getTransactionsByStoreId(
            storeId,
            startDate,
            endDate
          );
        } catch (error) {
          console.error("Error retrieving transactions:", error);
          throw new Error("Failed to fetch transactions.");
        }
      },
    });
  },
});

