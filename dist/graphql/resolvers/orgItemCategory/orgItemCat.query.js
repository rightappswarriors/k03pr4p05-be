import { extendType, arg, nonNull, nullable, intArg, stringArg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
export const OrgItemCategoryQuery = extendType({
    type: "Query",
    definition(t) {
        // Get all org's customized categories
        t.nonNull.list.nonNull.field("getOrgCategories", {
            type: "OrgItemCategory",
            args: {
                pageSize: nullable(arg({ type: "Int" })),
                query: nullable(stringArg()),
                orderBy: nullable(stringArg()),
                groupId: nullable(intArg()), // optional filter by group
                isActive: nullable(arg({ type: "Boolean" })), // optional filter by active
            },
            async resolve(_, { pageSize, query, orderBy, groupId, isActive }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                const orgId = ctx.user.orgId;
                orderBy = orderBy ?? "desc";
                if (orderBy !== "asc" && orderBy !== "desc") {
                    throw new Error("orderBy must be 'asc' or 'desc'.");
                }
                pageSize = pageSize ?? 50;
                try {
                    return await ctx.prisma.orgItemCategory.findMany({
                        where: {
                            orgId,
                            ...(groupId && { groupId }),
                            ...(isActive !== null && isActive !== undefined && { isActive }),
                            ...(query && {
                                OR: [
                                    { name: { contains: query, mode: "insensitive" } },
                                    { globalCategory: { name: { contains: query, mode: "insensitive" } } },
                                ],
                            }),
                        },
                        include: { globalCategory: true, group: true },
                        orderBy: { createdAt: orderBy },
                        take: pageSize,
                    });
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting org categories:", error);
                    throw new Error("Error getting org categories.");
                }
            },
        });
        // Get one org category by ID
        t.nullable.field("getOrgCategoryById", {
            type: "OrgItemCategory",
            args: {
                id: nonNull(intArg()),
            },
            async resolve(_, { id }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                const orgId = ctx.user.orgId;
                try {
                    const category = await ctx.prisma.orgItemCategory.findFirst({
                        where: { id, orgId },
                        include: { globalCategory: true, group: true, items: true },
                    });
                    if (!category)
                        throw new Error("Category not found.");
                    return category;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting org category:", error);
                    throw new Error("Error getting org category.");
                }
            },
        });
        // Get items under an org's customized category
        t.nonNull.list.nonNull.field("getOrgCategoryItems", {
            type: "Item",
            args: {
                id: nonNull(intArg()), // OrgItemCategory id
            },
            async resolve(_, { id }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                const orgId = ctx.user.orgId;
                // verify ownership first
                const orgCategory = await ctx.prisma.orgItemCategory.findFirst({
                    where: { id, orgId },
                });
                if (!orgCategory)
                    throw new Error("Category not found or does not belong to your organization.");
                try {
                    return await ctx.prisma.item.findMany({
                        where: {
                            orgId,
                            OR: [
                                { categoryId: id }, // direct category
                                { categories: { some: { categoryId: id } } } // via ItemCategoryMap
                            ]
                        },
                    });
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting category items:", error);
                    throw new Error("Error getting category items.");
                }
            },
        });
    },
});
