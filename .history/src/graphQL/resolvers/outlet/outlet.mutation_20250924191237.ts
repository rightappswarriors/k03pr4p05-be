import { extendType, arg, nonNull, nullable } from "nexus";
import {
  requireRole,
  requireAuth,
  requireOwnership,
} from "../../../middleware/auth.middleware.js";
import * as outletService from "../../../services/outlet.service.js";

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
               users: nonNull(arg({ type: "List"}))
          },
          async resolve(
               _,
               { id, users},
               ctx
          ) {
               requireAuth(ctx);
               requireRole(ctx, ["ADMIN", "MANAGER"]),
               requireOwnership(ctx, "Outlet", id)
          }

    })
  },
});
