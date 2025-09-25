import { extendType, arg, nonNull, list } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as categoryService from "../../../services/category.service.js";

export const categoryMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.list.nonNull.field("createCategories", {
      type: "Category",
      args: {
        categories: nonNull(list(nonNull(arg({ type: "String" })))),
      },
      async resolve(_, { categories }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        if (!categories.length) {
          throw new Error("Request body must be a non-empty array of categories.");
        }

        try {
          // map into objects that Prisma expects
          const data = categories.map((name) => ({ name }));
          return await categoryService.createCategories(data);
        } catch (error) {
          if (error.code === "P2002") {
            throw new Error("One or more categories already exist.");
          }
          console.error("Error creating categories:", error);
          throw new Error("Error creating categories.");
        }
      },
    });
  },
});
