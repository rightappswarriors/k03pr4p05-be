import { extendType, arg, nonNull, nullable, stringArg } from "nexus";
import * as categoryService from "../../../services/category.service.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";
export const CategoryQuery = extendType({
    type: "Query",
    definition(t) {
        // Get a single global category by ID
        t.nonNull.field("getCategoryById", {
            type: "ItemCategory",
            args: {
                id: nonNull(arg({ type: "ID" })),
            },
            async resolve(_, { id }, ctx) {
                requireAuth(ctx);
                try {
                    const category = await categoryService.getCategoryById(Number(id));
                    if (!category)
                        throw new Error(`Category with id ${id} not found`);
                    return category;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting category:", error);
                    throw new Error("Error getting category.");
                }
            },
        });
        // Browse all global categories (orgs use this to pick which to customize)
        t.nonNull.list.nonNull.field("getAllCategories", {
            type: "ItemCategory",
            args: {
                pageSize: nullable(arg({ type: "Int" })),
                query: nullable(stringArg()),
                orderBy: nullable(stringArg()),
            },
            async resolve(_, { pageSize, query, orderBy }, ctx) {
                requireAuth(ctx);
                orderBy = orderBy ?? "desc";
                if (orderBy !== "asc" && orderBy !== "desc") {
                    throw new Error("orderBy must be 'asc' or 'desc'.");
                }
                pageSize = pageSize ?? 50;
                try {
                    return await categoryService.getAllCategories(query, orderBy, pageSize);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting all categories:", error);
                    throw new Error("Error getting all categories.");
                }
            },
        });
    },
});
