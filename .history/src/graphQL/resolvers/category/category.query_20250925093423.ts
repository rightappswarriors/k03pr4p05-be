import { extendType, arg, nonNull } from "nexus";
import * as categoryService from "../../../services/category.service.js";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";

export const CategoryQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("getCategoryItems", {
      type: "Item",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(parent, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["MANAGER", "ADMIN"]);
        if (!id) {
          throw new Error("Please Select Category");
        }
        try {
          return await categoryService.getItemsByCategoryId(Number(id));
        } catch (error) {
          console.error("Error getting Category items:", error);
          throw new Error("Error getting Category items.");
        }
      },
    });
    t.nonNull.field("getCategoryById", {
      type: "Category",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        if (!id) {
          throw new Error("Please select a Category.");
        }
        try {
          return await categoryService.getCategoryById(Number(id));
        } catch (error) {
          console.error("Error getting category data", error);
          throw new Error("Error getting category data");
        }
      },
    });
    
  },
});
