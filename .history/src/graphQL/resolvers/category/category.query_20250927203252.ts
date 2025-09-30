// resolvers/CategoryQuery.ts
import { extendType, arg, nonNull, nullable, stringArg } from "nexus";
import * as categoryService from "../../../services/category.service.js";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";

export const CategoryQuery = extendType({
  type: "Query",
  definition(t) {
    //!SECTION Get Category Items
    t.nonNull.list.nonNull.field("getCategoryItems", {
      type: "Item",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["MANAGER", "ADMIN"]);

        try {
          return await categoryService.getItemsByCategoryId(Number(id));
        } catch (error) {
          console.error("Error getting Category items:", error);
          throw new Error("Error getting Category items.");
        }
      },
    });
    //!SECTION getCategory By ID
    t.nonNull.field("getCategoryById", {
      type: "Category",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);

        try {
          return await categoryService.getCategoryById(Number(id));
        } catch (error) {
          console.error("Error getting category data", error);
          throw new Error("Error getting category data");
        }
      },
    });
    //!SECTION Get ALL CATEGORIES
    t.nonNull.list.nonNull.field("getAllCategory", {
      type: "Category",
      args: {
        pageSize: nullable(arg({ type: "Int"})),
        query: nullable(stringArg()),
        orderBy: nullable(stringArg())
      },
      async resolve(_, { pageSize, query, orderBy}, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["MANAGER", "ADMIN"]);
        if (!orderBy) {
          orderBy = "desc"
        if (orderBy !== "asc" || orderBy !=="desc") {
          throw new Error("Order not valid")
        }
        }
        try {
          return await categoryService.getAllCategories(query, orderBy, pageSize);
        } catch (error) {
          console.log("Error getting all Categories:", error);
          throw new Error("Error getting all Categories.");
        }
      },
    });
  },
});
