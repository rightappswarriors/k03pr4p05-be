import { extendType, arg, nonNull } from "nexus";
import * as outletService from "../../../services/outlet.service.js";
import {
  requireAuth,
  requireRole,
  requireOwnership,
} from "../../../middleware/auth.middleware.js";

export const outletQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("getOutletById", {
      type: "Outlet",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { id }, ctx) {
        // optional auth/role checks
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);
        await requireOwnership(ctx, "Outlet", id);

        return await outletService.getOutletById(Number(id));
      },
    });
    t.nonNull.list.nonNull.field("getOutletsByBranch", {
      type: "Outlet",
      args: {
        branchId: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { branchId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);
        await requireOwnership(ctx, "branch", branchId);

        try {
          return await outletService.getOutletsByBranchId(Number(branchId));
        } catch (error) {
          console.error("Error getting outlet by branch:", error);
          throw new Error("Error getting outlet by branch");
        }
      },
    });
    // Get outlet Staff
    t.nonNull.list.nonNull.field("getOutletStaff", {
      type: "User",
      args: {
        outletId: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGING"]);
        try {
          return await outletService.getOutletStaffs(outletId);
        } catch (error) {
          console.error("Error getting outlet staffs:", error);
          throw new Error("Error getting outlet staffs");
        }
      },
    });
    t.nonNull.list.nonNull.field("getOutletItems", {
     type: "Outlet",
     async resolve(_,  __, ctx) {
       requireAuth(ctx);
       requireRole(ctx, ["ADMIN", "MANAGING"]);
       try {
         return await outletService.getOutletItemsByAssingedStaff(ctx.user.userId);
       } catch (error) {
         console.error("Error getting outlet items:", error);
         throw new Error("Error getting outlet items");
       }
     },
   });
  },
});
