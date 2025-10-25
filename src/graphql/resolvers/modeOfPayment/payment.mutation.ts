import { extendType, nonNull, intArg, arg, inputObjectType } from "nexus";
import * as modeOfPaymentService from "../../../services/modeOfPayment.service.js";
import {
  requireAuth,
  requireOwnership,
  requireRole,
} from "../../../middleware/auth.middleware.js";

export const CreateModeOfPaymentInput = inputObjectType({
  name: "CreateModeOfPaymentInput",
  definition(t) {
    t.nonNull.string("name");
    t.nullable.field("accountLink", { type: "AccountLink" });
    t.nonNull.int("supplierId");
  },
});

export const UpdateModeOfPaymentInput = inputObjectType({
  name: "UpdateModeOfPaymentInput",
  definition(t) {
    t.nullable.string("name");
    t.nullable.field("accountLink", { type: "AccountLink" });
  },
});
export const ModeOfPaymentMutation = extendType({
  type: "Mutation",
  definition(t) {
    // ✅ Create Mode of Payment
    t.field("createModeOfPayment", {
      type: "ModeOfPayment",
      args: {
        data: nonNull(arg({ type: "CreateModeOfPaymentInput" })),
      },
      async resolve(_, { data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        // Optional: verify supplier ownership if relevant
        // await requireOwnership(ctx, "Supplier", data.supplierId);

        try {
          return await modeOfPaymentService.createModeOfPayment({
            name: data.name,
            accountLink: data.accountLink,
            supplier: { connect: { id: data.supplierId } },
          });
        } catch (error) {
          console.error("Error creating Mode of Payment:", error);
          throw new Error("Failed to create Mode of Payment.");
        }
      },
    });

    // ✅ Update Mode of Payment
    t.field("updateModeOfPayment", {
      type: "ModeOfPayment",
      args: {
        id: nonNull(intArg()),
        data: nonNull(arg({ type: "UpdateModeOfPaymentInput" })),
      },
      async resolve(_, { id, data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await modeOfPaymentService.updateModeOfPayment(id, data);
        } catch (error) {
          console.error("Error updating Mode of Payment:", error);
          throw new Error("Failed to update Mode of Payment.");
        }
      },
    });

    // ✅ Delete Mode of Payment
    t.boolean("deleteModeOfPayment", {
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          await modeOfPaymentService.deleteModeOfPayment(id);
          return true;
        } catch (error) {
          if (error.code === "P2025") {
            throw new Error("Mode of Payment not found.");
          }
          console.error("Error deleting Mode of Payment:", error);
          throw new Error("Failed to delete Mode of Payment.");
        }
      },
    });
  },
});
