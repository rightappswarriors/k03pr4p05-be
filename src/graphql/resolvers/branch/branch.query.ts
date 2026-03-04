import { arg, extendType, nonNull, nullable, stringArg } from "nexus";
import * as branchService from "../../../services/branch.service.js";
import * as middleware from "../../../middleware/auth.middleware.js";

export const branchQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("getOwnedBranches", {
      type: "Branch",
      resolve: async (parent, args, ctx) => {
        middleware.requireAuth(ctx);
        middleware.requireRole(ctx, ["ADMIN"]);
        try {
          return await branchService.getOwnedBranches(ctx.user.userId);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error in getOwnedBranches:", error);
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
        middleware.requireAuth(ctx);
        middleware.requireRole(ctx, ["ADMIN"]);
        try {
          const branchId = parseInt(id);
          return await branchService.getBranchById(branchId);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error getting your owned branch data:", error);
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
        middleware.requireAuth(ctx);
        middleware.requireRole(ctx, ["ADMIN", "OWNER",]);
        try {
          const branchId = parseInt(id);
          return await branchService.getBranchTransactions(branchId, startDate, endDate)
        }
        catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error Failed to fetch branch transactions:", error);
          throw new Error("Failed to fetch branch transactions");
        }
      }
    })
  },
});
