import { extendType, arg, nonNull, nullable } from "nexus";
import {
  requireRole,
  requireAuth,
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
        governmentCharge: nonNull(arg({ type: "String" })),
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
        const fieldExists = await ctx.prisma.outlet.findFirst({
          where: {
            OR: [{ name: name }, { code: code }],
          },
        });
        if (fieldExists) {
          if (fieldExists.name === name) {
            throw new Error(`Outlet with  this name: ${name} already exists`);
          } else {
            throw new Error(`Outlet with this code: ${code} already exists`);
          }
        }
        try {
          return await outletService.createOutlet(
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
            branchId,
            userId
          );
        } catch (error) {
          console.error("Error creating outlet", error);
          throw new Error("Error creating outlet");
        }
      },
    });
  },
});
