import { extendType, arg, nonNull, nullable } from "nexus";
import { requireRole, requireAuth } from "../../../middleware/auth.middleware.js";


export const TransactionMutation = extendType({
     type: "Mutation",
     definition(t) {
          
     }
})