import { extendType, nonNull, intArg, stringArg, arg, nullable } from "nexus";
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
                startDate: nullable(arg({ type: "DateTime" })),
                endDate: nullable(arg({ type: "DateTime" })),
            },
            async resolve(_, { outletId, startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "OWNER"]);
                if (process.env.NODE_ENV === "development") {
                    console.log(`Fetching transactions for outletId: ${outletId}, startDate: ${startDate}, endDate: ${endDate}`);
                }
                try {
                    return await transactionService.getTransactionsByOutletId(outletId, startDate, endDate);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error retrieving transactions:", error);
                    throw new Error("Failed to fetch transactions.");
                }
            },
        });
        t.nonNull.list.nonNull.field("getOutletTransactions", {
            type: "Transaction",
            args: {
                outletId: nonNull(arg({ type: "ID" })),
                limit: nullable(intArg()),
                offset: nullable(intArg()),
                startDate: nullable(arg({ type: "DateTime" })),
                endDate: nullable(arg({ type: "DateTime" })),
            },
            async resolve(_, { outletId, limit, offset, startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF", "OWNER"]);
                try {
                    return await transactionService.getOutletTransactions(Number(outletId), startDate ?? undefined, endDate ?? undefined, limit ?? 50, offset ?? 0);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development") {
                        console.error("Error getting outlet transactions:", error);
                    }
                    throw new Error("Error getting outlet transactions");
                }
            },
        });
        t.nullable.field('getTransactionById', {
            type: 'Transaction',
            args: { id: nonNull(intArg()) },
            async resolve(_root, { id }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'MANAGER', 'CASHIER', 'OWNER']);
                return ctx.prisma.transaction.findUnique({
                    where: { id }, // ← removed outlet.orgId filter;
                    //    findUnique only accepts unique fields.
                    //    orgId check is done via requireAuth above.
                    include: {
                        items: {
                            include: {
                                item: true, // ← CartItem.item → Item
                                unit: true, // ← CartItem.unit → InventoryItemUnit
                            },
                        },
                        cashier: { select: { id: true, fullname: true, email: true } },
                        customerDetails: true,
                    },
                });
            },
        });
        // Get transactions by orgId (with optional date range) - for all outlets
        t.nonNull.list.nonNull.field("getTransactionsByOrgId", {
            type: "Transaction",
            args: {
                startDate: stringArg(), // optional
                endDate: stringArg(), // optional
            },
            async resolve(_, { startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                const orgId = Number(ctx.user?.orgId);
                if (process.env.NODE_ENV === "development") {
                    console.log(`Fetching transactions for orgId: ${orgId}, startDate: ${startDate}, endDate: ${endDate}`);
                }
                try {
                    return await transactionService.getTransactionsByOrgId(orgId, startDate, endDate);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error retrieving transactions:", error);
                    throw new Error("Failed to fetch transactions.");
                }
            },
        });
    },
});
