/**import { extendType } from "nexus";
import * as modeOfPaymentService from "../../../services/modeOfPayment.service.js";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";

export const ModeOfPaymentQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("modeOfPayments", {
      type: "ModeOfPayment",
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        return await modeOfPaymentService.getModeOfPayments();
      },
    });
  },
});*/
