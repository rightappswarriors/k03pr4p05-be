import { extendType, intArg, objectType, stringArg, booleanArg, nullable } from "nexus";
import { PAGE_PERMISSIONS } from "../../../lib/permissions.map.js";
export const AdminUsersResult = objectType({
    name: "AdminUsersResult",
    definition(t) {
        t.nonNull.list.nonNull.field("items", { type: "User" });
        t.nonNull.int("total");
        t.nonNull.int("page");
        t.nonNull.int("pageSize");
    },
});
export const AdminUsersQuery = extendType({
    type: "Query",
    definition(t) {
        t.field("adminUsers", {
            type: "AdminUsersResult",
            args: {
                search: nullable(stringArg()),
                page: nullable(intArg()),
                pageSize: nullable(intArg()),
                sortDirection: nullable(stringArg()), // "ASC" | "DESC"
                verified: nullable(booleanArg()),
                active: nullable(booleanArg()),
            },
            async resolve(_root, args, ctx) {
                PAGE_PERMISSIONS.admin.view(ctx);
                const page = args.page ?? 1;
                const pageSize = args.pageSize ?? 30;
                const skip = (page - 1) * pageSize;
                const sortDir = (args.sortDirection ?? "DESC").toLowerCase();
                const where = {};
                if (args.search) {
                    const search = args.search.trim();
                    where.OR = [
                        { fullname: { contains: search, mode: "insensitive" } },
                        { username: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                    ];
                }
                if (args.verified !== null && args.verified !== undefined) {
                    where.isVerified = args.verified;
                }
                if (args.active !== null && args.active !== undefined) {
                    where.isActive = args.active;
                }
                const [items, total] = await Promise.all([
                    ctx.prisma.user.findMany({
                        where,
                        orderBy: { createdAt: sortDir },
                        skip,
                        take: pageSize,
                        include: {
                            org: { select: { id: true, name: true } },
                            position: { select: { id: true, name: true } },
                            department: { select: { id: true, label: true } },
                        },
                    }),
                    ctx.prisma.user.count({ where }),
                ]);
                return { items, total, page, pageSize };
            },
        });
    },
});
