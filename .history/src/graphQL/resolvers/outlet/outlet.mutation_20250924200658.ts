import { extendType, arg, nonNull, nullable, list, inputObjectType } from "nexus";
import {
  requireRole,
  requireAuth,
  requireOwnership,
} from "../../../middleware/auth.middleware.js";
import * as outletService from "../../../services/outlet.service.js";
export const OutletStaffInput = inputObjectType({
     name: "OutletStaffInput",
     definition(t) {
       t.nonNull.int("userId");
       t.nonNull.string("role");
     },
   });
   
export const outletMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("createOutlet", {
      type: "Outlet",
      args: {
        branchId: nonNull(arg({ type: "ID" })),
        name: nonNull(arg({ type: "String" })),
        address: nonNull(arg({ type: "String" })),
        phone: nonNull(arg({ type: "String" })),
        code: nonNull(arg({ type: "String" })),
        governmentCharge: nonNull(arg({ type: "Float" })),
        serviceCharge: nonNull(arg({ type: "Float" })),
        outletType: nonNull(arg({ type: "OutletType" })),
      },
      async resolve(
        _,
        {
          branchId,
          name,
          address,
          phone,
          code,
          governmentCharge,
          serviceCharge,
          outletType,
        },
        ctx
      ) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);
        const userId = ctx.user.userId;
        if (!name || !address || !code || !outletType || !branchId) {
          throw new Error(
            "Missing required fields: name, address, code, outletType, branchId"
          );
        }
        try {
          return await outletService.createOutlet(
            {
              name,
              address,
              phone,
              code,
              governmentCharge,
              serviceCharge,
              outletType,
            },
            Number(branchId),
            Number(userId)
          );
        } catch (error) {
          if (error.code === "P2002") {
            const target = error.meta?.target;
            if (target.includes("name")) {
              throw new Error(`Outlet with this name already exists`);
            }
            if (target.includes("code")) {
              throw new Error(`Outlet with this code already exists`);
            }
            throw new Error("A unique constraint failed");
          }
          console.error("Error creating outlet", error);
          throw new Error("Error creating outlet");
        }
      },
    });
    t.nonNull.field("createOutletStaff", {
      type: "OutletStaff",
      args: {
        id: nonNull(arg({ type: "ID" })),
        users: nonNull(arg({ type: list(nonNull("OutletStaffInput")) })),

      },
      async resolve(_, { id, users }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        await requireOwnership(ctx, "Outlet", id);
        try {
          if (Array.isArray(users)) {
            if (users.length === 0) {
              throw new Error(
                "Request body must be a non-empty array of users."
              );
            }

            return await outletService.addStaffsToOutlet(users);
          } else {
            const { userId, role } = users;
            if (!userId || !role) {
              // Use 400 for a bad request (missing data)
              throw new Error("Missing required fields: userId and role");
            }
            return await outletService.addStaffToOutlet(
              Number(id),
              userId,
              role
            );
          }
        } catch (error) {
          console.error(
            "An unexpected error occurred while adding staff:",
            error
          );
          throw new Error("An unexpected error occurred while adding staff.");
        }
      },
    });
    t.nonNull.field("deleteOutletStaffs", {
      type: "OutletStaff",
      args: {
        id: nonNull(arg({ type: "ID" })),
        userIds: nonNull(arg({ type: nonNull(list(nonNull("ID"))) })),
      },
      async resolve(_, { id, userIds }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        await requireOwnership(ctx, "Outlet", id);
        if (
          !id ||
          !userIds ||
          !Array.isArray(userIds) ||
          userIds.length === 0
        ) {
          throw new Error("Store ID and at least one User ID are required.");
        }
        try {
          return await outletService.removeStaffsFromOutlet(
            Number(id),
            userIds
          );
        } catch (error) {
          console.error(
            "An unexpected error has occured while deleteing staffs: ",
            error
          );
          throw new Error(
            "An unexpected error has occured while deleteing staffs"
          );
        }
      },
    });
  },
});
