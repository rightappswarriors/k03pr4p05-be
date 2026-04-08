//rai-pos-backend\src\graphql\resolvers\branch\branch.query.ts
import { arg, extendType, nonNull, nullable, stringArg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as branchService from "../../../services/branch.service.js";
export const branchQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.list.nonNull.field("getOrgBranches", {
            type: "Branch",
            resolve: async (parent, {}, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user.orgId);
                return await ctx.prisma.branch.findMany({
                    where: { orgId },
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        isActive: true
                    }
                });
            }
        });
        t.nonNull.list.nonNull.field("getOwnedBranches", {
            type: "Branch",
            args: {
                search: nullable(stringArg()),
            },
            resolve: async (parent, { search }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER"]);
                try {
                    return await branchService.getOwnedBranches(Number(ctx.user.orgId), search);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error in getOwnedBranches:", error);
                    throw new Error("Failed to fetch owned branches");
                }
            },
        });
        t.nonNull.field("getBranchById", {
            type: "Branch",
            args: {
                id: nonNull(arg({ type: "ID" })),
            },
            resolve: async (parent, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER"]);
                try {
                    const branchId = parseInt(id);
                    return await branchService.getBranchById(branchId);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting your owned branch data:", error);
                    throw new Error("Error getting your owned branch data:", error.message);
                }
            },
        });
        t.nonNull.list.nonNull.field("getBranchTransactions", {
            type: "Transaction",
            args: {
                id: nonNull(arg({ type: "ID" })),
                startDate: nullable(arg({ type: "DateTime" })),
                endDate: nullable(arg({ type: "DateTime" })),
            },
            resolve: async (parent, { id, startDate, endDate }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER",]);
                try {
                    const branchId = parseInt(id);
                    return await branchService.getBranchTransactions(branchId, startDate, endDate);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error Failed to fetch branch transactions:", error);
                    throw new Error("Failed to fetch branch transactions");
                }
            }
        });
    },
});
