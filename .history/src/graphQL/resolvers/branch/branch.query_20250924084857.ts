import { arg, extendType, nonNull } from "nexus";
import * as branchService from "../../../services/branch.service.js";
import * as middleware from "../../../middleware/auth.middleware.js";
export const branchQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("getOwnedBranches", {
      type: "Branch",
      resolve: async (parent, args, ctx) => {
        middleware.requireAuth(ctx);
        middleware.requireRole(["ADMIN"]);
        try {
          branchService.getOwnedBranches(ctx.user.userId);
        } catch (error) {
          console.error("Authentication required");
          throw new Error("Authentication required");
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
        middleware.requireRole(["ADMIN"]);
        try {
          const branchId = parseInt(id)
          return await branchService.getBranchById(branchId)
        } catch (error) {
          console.error("Error getting all user data:", error);
          throw new Error("Error getting all user data:", error.message);
        }
      },
    });
  },
});
