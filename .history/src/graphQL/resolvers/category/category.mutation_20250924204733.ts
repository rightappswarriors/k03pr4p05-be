import { extendType, arg, nonNull } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as categoryService from "../../../services/category.service.js";

export const categoryMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("createCategory", {
      type: "Category",
      args: {
        name: nonNull(arg({ type: "String" })),
      },
      async resolve(_, { name }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await categoryService.createCategory({ name });
        } catch (error) {
          if (error.code === "P2002") {
            throw new Error("A category with this name already exists.");
          }
          console.error("Error creating category:", error);
          throw new Error("Error creating category.");
        }
      },
    });
  },
});
