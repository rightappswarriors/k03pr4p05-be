//rai-pos-backend\src\graphql\resolvers\outlet\outlet.query.ts
import { objectType, extendType, arg, nonNull, nullable, stringArg } from "nexus";
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
    t.string("bannerImage")
    t.string("address");
    t.string("phone");
    t.string("code");
    t.float("governmentTax");
    t.float("serviceCharge");
    t.boolean("isActive");
    t.boolean("hasKey")
    t.string("outletType");
    t.boolean("isVatRegistered");
    t.float("vatZeroSale");
    t.string("tin");
    t.string("ptu");
    t.string("bir");
    t.field("vatType", { type: "VatType" });
    t.list.field("outletPromos", { type: "OutletPromo" });
    t.nonNull.list.nonNull.field("items", { type: "InventoryItems" });
  },
});

export const MyOutletAssignment = objectType({
  name: "MyOutletAssignment",
  definition(t) {
    t.nonNull.int("outletId");
    t.nonNull.string("role");
    t.nonNull.string("outletName");
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
        requireRole(ctx, ["ADMIN", "OWNER"]);
        await requireOwnership(ctx, "Outlet", id);
        return await outletService.getOutletById(Number(id));
      },
    });
    t.nullable.field("myOutletAssignment", {
      type: "MyOutletAssignment",
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["CASHIER", "STAFF", "MANAGER", "OWNER", "ADMIN"]);
        const userId = Number(ctx.user.userId);
        try {
          return await outletService.getMyOutletAssignment(userId);
        } catch (error) {
          if (process.env.NODE_ENV === "development")
            console.error("Error getting outlet assignment:", error);
          throw new Error("Error getting outlet assignment");
        }
      },
    });
    t.nonNull.list.nonNull.field("getOutletsByBranchIDD", {
      type: "Outlet",
      args: {
        branchId: nonNull(arg({ type: "ID" })),
        search: nullable(stringArg()),
      },
      async resolve(_, { branchId, search }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "OWNER"]);
        await requireOwnership(ctx, "branch", branchId);

        try {
          return await outletService.getOutletsByBranchId(Number(branchId), search);
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
        requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
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
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF", "OWNER"]);

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
    t.nullable.field("getInventoryItemById", {
      type: "InventoryItems",
      args: { id: nonNull(arg({ type: "ID" })) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
        return await outletService.getInventoryItemById(Number(id));
      },
    });
    t.nonNull.list.nonNull.field("getOutletTransactionsMoney", {
      type: "Transaction",
      args: {
        outletId: nonNull(arg({ type: "ID" })),
        startDate: nullable(arg({ type: "DateTime" })),
        endDate: nullable(arg({ type: "DateTime" })),
      },
      async resolve(_, { outletId, startDate, endDate }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF", "OWNER"]);
        try {
          return await outletService.getOutletTransactions(Number(outletId), startDate, endDate);
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error getting outlet transactions:", error);
          }
          throw new Error("Error getting outlet transactions");
        }
      },
    });
    t.nonNull.list.nonNull.field("getOutlets", {
      type: "Outlet",
      async resolve(_, __, ctx) {
        requireAuth(ctx)
        requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER'])

        try {
          return await outletService.getOutlets()
        } catch (error) {
          console.error("Error getting outlets:", error);

          throw new Error("Error getting outlets");
        }
      }
    })
    t.nonNull.list.nonNull.field("getPresentStaffs", {
      type: "OutletPresentStaffs",
      args: {
        outletId: nonNull(arg({ type: "ID" }))
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "CASHIER", "STAFF", "OWNER"]);
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
