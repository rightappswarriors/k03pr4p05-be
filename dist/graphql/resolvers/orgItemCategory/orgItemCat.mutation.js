import { extendType, arg, nonNull, intArg, stringArg, nullable } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
export const orgItemCategoryMutation = extendType({
    type: "Mutation",
    definition(t) {
        // Org picks a global category and customizes it
        // orgItemCat.mutation.ts
        t.nonNull.field("createOrgItemCategory", {
            type: "OrgItemCategory",
            args: {
                name: nonNull(stringArg()), // ✅ name is now required
                categoryId: nullable(intArg()), // ✅ optional — only if linking to global
                description: nullable(stringArg()),
                icon: nullable(stringArg()),
                cost_of_sale: nullable(stringArg()),
                groupType: nullable(stringArg()),
                sales: nullable(stringArg()),
                stocks: nullable(stringArg()),
                groupId: nullable(intArg()),
            },
            async resolve(_, args, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                const orgId = ctx.user.orgId;
                // check duplicate name within org
                const existing = await ctx.prisma.orgItemCategory.findUnique({
                    where: { orgId_name: { orgId, name: args.name } },
                });
                if (existing)
                    throw new Error("Category with this name already exists.");
                // ✅ no global category check needed anymore
                return ctx.prisma.orgItemCategory.create({
                    data: {
                        orgId,
                        name: args.name,
                        categoryId: args.categoryId ?? null, // optional link
                        description: args.description,
                        icon: args.icon,
                        cost_of_sale: args.cost_of_sale,
                        groupType: args.groupType,
                        sales: args.sales,
                        stocks: args.stocks,
                        groupId: args.groupId,
                    },
                });
            },
        });
        // Org updates their customized category
        t.nonNull.field("updateOrgItemCategory", {
            type: "OrgItemCategory",
            args: {
                id: nonNull(intArg()),
                name: nullable(stringArg()),
                description: nullable(stringArg()),
                icon: nullable(stringArg()),
                cost_of_sale: nullable(stringArg()),
                groupType: nullable(stringArg()),
                sales: nullable(stringArg()),
                stocks: nullable(stringArg()),
                groupId: nullable(intArg()),
                isActive: nullable(arg({ type: "Boolean" })),
            },
            async resolve(_, { id, ...args }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                const orgId = ctx.user.orgId;
                // make sure this org owns this category
                const orgCategory = await ctx.prisma.orgItemCategory.findFirst({
                    where: { id, orgId },
                });
                if (!orgCategory) {
                    throw new Error("Category not found or does not belong to your organization.");
                }
                try {
                    return await ctx.prisma.orgItemCategory.update({
                        where: { id },
                        data: {
                            name: args.name,
                            description: args.description,
                            icon: args.icon,
                            cost_of_sale: args.cost_of_sale,
                            groupType: args.groupType,
                            sales: args.sales,
                            stocks: args.stocks,
                            groupId: args.groupId,
                            isActive: args.isActive,
                        },
                    });
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error updating OrgItemCategory:", error);
                    throw new Error("Error updating org category.");
                }
            },
        });
        // Org deletes their customized category
        t.nonNull.field("deleteOrgItemCategory", {
            type: "OrgItemCategory",
            args: {
                id: nonNull(intArg()),
            },
            async resolve(_, { id }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER"]);
                const orgId = ctx.user.orgId;
                // make sure this org owns this category
                const orgCategory = await ctx.prisma.orgItemCategory.findFirst({
                    where: { id, orgId },
                });
                if (!orgCategory) {
                    throw new Error("Category not found or does not belong to your organization.");
                }
                try {
                    return await ctx.prisma.orgItemCategory.update({
                        where: { id },
                        data: { deletedAt: new Date() },
                    });
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error deleting OrgItemCategory:", error);
                    throw new Error("Error deleting org category.");
                }
            },
        });
    },
});
