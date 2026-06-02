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
        t.nonNull.list.nonNull.field("scPwdCustomers", {
            type: "ScPwdCustomer",
            args: {
                search: nullable(stringArg()),
            },
            async resolve(_, { search }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF", "OWNER"]);
                return ctx.prisma.scPwdCustomer.findMany({
                    where: {
                        ...(ctx.user?.orgId ? { orgId: Number(ctx.user.orgId) } : {}),
                        ...(search
                            ? {
                                OR: [
                                    { fullName: { contains: search, mode: "insensitive" } },
                                    { idNumber: { contains: search, mode: "insensitive" } },
                                ],
                            }
                            : {}),
                    },
                    orderBy: { createdAt: "desc" },
                });
            },
        });
        t.nullable.field("scPwdCustomer", {
            type: "ScPwdCustomer",
            args: { id: nonNull(stringArg()) },
            async resolve(_, { id }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF", "OWNER"]);
                return ctx.prisma.scPwdCustomer.findUnique({ where: { id } });
            },
        });
        t.nonNull.list.nonNull.field("transactionsByDiscountType", {
            type: "Transaction",
            args: { discountType: nonNull(arg({ type: "DiscountType" })) },
            async resolve(_, { discountType }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                return transactionService.getTransactionsByDiscountType(discountType, ctx.user?.orgId ? Number(ctx.user.orgId) : undefined);
            },
        });
        t.nullable.field("bnpcDiscountStatus", {
            type: "DiscountStatus",
            args: {
                customerId: nullable(stringArg()),
                oscaGovId: nullable(stringArg()),
            },
            async resolve(_, { customerId, oscaGovId }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF", "OWNER"]);
                if (!customerId && !oscaGovId)
                    return null;
                const status = await transactionService.getWeeklyBnpcState(ctx.prisma, customerId ?? undefined, oscaGovId ?? undefined);
                return {
                    customerId: customerId ?? undefined,
                    oscaGovId: oscaGovId ?? undefined,
                    weeklyCapUsed: status.weeklyCapUsed,
                    eligibleAmountUsed: status.eligibleAmountUsed,
                    capRemaining: Math.max(0, 125 - (status.weeklyCapUsed ?? 0)),
                    purchaseRemaining: Math.max(0, 2500 - (status.eligibleAmountUsed ?? 0)),
                    bnpcDiscountApplied: status.bnpcDiscountApplied,
                    capManuallyReached: status.capManuallyReached,
                    lastResetDate: status.lastResetDate,
                };
            },
        });
        t.nonNull.list.nonNull.field("birDiscountLogbook", {
            type: "BirDiscountLogbookEntry",
            args: {
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
            },
            async resolve(_, { startDate, endDate }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                return transactionService.getBirDiscountLogbook(startDate ?? undefined, endDate ?? undefined, ctx.user?.orgId ? Number(ctx.user.orgId) : undefined);
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
