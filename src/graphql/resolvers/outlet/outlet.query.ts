import { objectType, extendType, arg, nonNull } from "nexus";
import * as outletService from "../../../services/outlet.service.js";

import {
  requireAuth,
  requireRole,
  requireOwnership,
} from "../../../middleware/auth.middleware.js";
export const OutletWithItems = objectType({
  name: "OutletWithItems",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.int("branchId");
    t.nonNull.string("name");
    t.string("address");
    t.string("phone");
    t.string("code");
    t.float("governmentTax");
    t.float("serviceCharge");
    t.boolean("isActive");
    t.string("outletType");
    t.nonNull.list.nonNull.field("items", { type: "InventoryItems" });
  },
});

export const OutletPresentStaffs = objectType({
  name: "OutletPresentStaffs",
  definition(t) {
    t.nonNull.field("user", {
      type: "User"
    })
    //t.nonNull.field("outlet", {
    //  type: "Outlet"
    // })
    t.nonNull.int("id")
    t.nonNull.boolean("isPresent")
    t.nonNull.int("outletId")
  }
})

export const OutletQuery = extendType({
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
          if (process.env.NODE_ENV === "development") console.error("Error getting outlet by branch:", error);
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
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        try {
          return await outletService.getOutletStaffs(Number(outletId));
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error getting outlet staffs:", error);
          throw new Error("Error getting outlet staffs");
        }
      },
    });
    t.nonNull.field("getOutletItems", {
      type: "OutletWithItems",
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);

        const userId = Number(ctx.user.userId);
        try {
          const items = await outletService.getOutletItemsByAssignedStaff(
            userId,
            ctx.user.role
          );
          if (!items) {
            throw new Error("No items found add items");
          }
          return items;
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error getting outlet items:", error);
          throw new Error("Error getting outlet items");
        }
      },
    });
    t.nonNull.list.nonNull.field("getOutletTransactions", {
      type: "Transaction",
      args: {
        outletId: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
        try {
          return await outletService.getOutletTransactions(Number(outletId));
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error getting outlet transactions:", error);
          }
          throw new Error("Error getting outlet transactions");
        }
      },
    });
    t.nonNull.list.nonNull.field("getPresentStaffs", {
      type: "OutletPresentStaffs",
      args: {
        outletId: nonNull(arg({ type: "ID" }))
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF"]);
        try {
          return await outletService.getPresentStaffs(Number(outletId))
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error getting outlet transactions:", error);
          }
          throw new Error("Error getting outlet transactions");
        }
      }
    })
  },
});
