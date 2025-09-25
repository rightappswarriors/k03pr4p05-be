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
        await requireOwnership(ctx, "branch", id);

        return await outletService.getOutletById(Number(id));
      },
    });
    t.nonNull.list.nonNull.field("getOutletsByBranch", {
     type:"Outlet",
     args: {
          branchId: nonNull(arg({type: "ID"}))
     },
     async resolve(_, { branchId }, ctx) {
          requireAuth(ctx);
          requireRole(ctx, ["ADMIN"])

          try {
               return await outletService.getOutletsByBranchId(Number(branchId))
          }catch (error) {
               console.error("Error getting outlet by branch:",error)
               throw new Error("Error getting outlet by branch")
          }
     }
    })
  },
});
