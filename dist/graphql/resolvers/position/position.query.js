import { extendType, nonNull, stringArg } from "nexus";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { PAGE_PERMISSIONS, requireAny } from "../../../lib/permissions.map.js";
export const positionQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.list.nonNull.field("positions", {
            type: "Position",
            resolve: async (_, {}, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user.orgId);
                return await ctx.prisma.position.findMany({
                    where: { orgId },
                    include: {
                        permissions: true,
                        controlPermissions: true,
                    }
                });
            }
        });
        t.nullable.field("position", {
            type: "Position",
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                requireAny(ctx, PAGE_PERMISSIONS.hr.view, PAGE_PERMISSIONS.masterFile.view);
                return await ctx.prisma.position.findUnique({
                    where: { id },
                    include: {
                        permissions: {
                            include: { page: true }
                        },
                        controlPermissions: true,
                    }
                });
            }
        });
        t.nonNull.list.nonNull.field("pages", {
            type: "Page",
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                requireAny(ctx, PAGE_PERMISSIONS.hr.view, PAGE_PERMISSIONS.masterFile.view);
                return await ctx.prisma.page.findMany({
                    orderBy: { sortOrder: 'asc' }
                });
            }
        });
    }
});
