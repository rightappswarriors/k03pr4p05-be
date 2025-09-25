import { extendType, arg, nonNull } from "nexus";
import * as categoryService from "../../../services/category.service.js";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";

export const CategoryQuery = extendType({
     type: "Query",
     definition(t) {
          t.nonNull.list.nonNull.field("getCategoryItems", {
               type: "Items",
               args: {
                    id: nonNull(arg({type: "ID"}))
               },
               async resolve(parent, {id}, ctx) {
                    requireAuth(ctx);
                    requireRole(ctx, ["MANAGER", "ADMIN"])
                    if (!id) {
                         throw new Error("Please Select Category")
                    }
                    try {

                    } catch(error) {
                         console.error("Error getting Category items:", error)
                         throw new Error("Error getting Category items.")
                    }
               }
          })
     }
})