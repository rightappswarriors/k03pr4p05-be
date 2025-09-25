
import { extendType, arg, nonNull, nullable } from "nexus";
import { requireRole, requireAuth } from "../../../middleware/auth.middleware.js";
import * as outletService from "../../../services/outlet.service.js"

export const outletMutation = extendType({
     type: "Mutation",
     definition(t) {
          
     }
})