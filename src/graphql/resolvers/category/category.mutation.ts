import { extendType, arg, nonNull, list } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as categoryService from "../../../services/category.service.js";

export const categoryMutation = extendType({
  type: "Mutation",
  definition(t) {
    // Super admin creates global categories
    t.nonNull.list.nonNull.field("createCategories", {
      type: "ItemCategory",
      args: {
        categories: nonNull(list(nonNull(arg({ type: "String" })))),
      },
      async resolve(_, { categories }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]); // ✅ only super admin

        if (!categories.length) {
          throw new Error("Request body must be a non-empty array of categories.");
        }

        try {
          const data = categories.map((name: string) => ({ name }));
          return await categoryService.createCategories(data);
        } catch (error) {
          if (error?.code === "P2002") {
            throw new Error("One or more categories already exist.");
          }
          if (process.env.NODE_ENV === "development") console.error("Error creating categories:", error);
          throw new Error("Error creating categories.");
        }
      },
    });

    t.nonNull.field("updateCategory", {
      type: "ItemCategory",
      args: {
        id: nonNull(arg({ type: "ID" })),
        name: nonNull(arg({ type: "String" })),
      },
      async resolve(_, { id, name }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]); // ✅ only super admin
        try {
          const category = await categoryService.updateCategoryById(Number(id), name);
          if (!category) throw new Error(`Category with id ${id} not found`);
          return category;
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error updating Category", error);
          throw new Error("Error updating Category");
        }
      },
    });

    t.nonNull.field("deleteCategory", {
      type: "ItemCategory",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]); // ✅ only super admin
        try {
          const category = await categoryService.deleteCategory(Number(id));
          if (!category) throw new Error("Error Deleting Category: Category not found");
          return category;
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error Deleting Category:", error);
          throw new Error("Error Deleting Category");
        }
      },
    });
  },
});