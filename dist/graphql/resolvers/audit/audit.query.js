import { arg, extendType, nonNull, nullable, intArg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
export const auditQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.list.nonNull.field("auditLogs", {
            type: "AuditLogType",
            args: {
                orgId: nonNull(intArg()),
                filters: nullable(arg({
                    type: "AuditLogFiltersInput"
                })),
                pagination: nullable(arg({
                    type: "PaginationInput"
                })),
            },
            resolve: async (parent, { orgId, filters, pagination }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["OWNER"]);
                const where = {
                    orgId,
                    ...(filters?.userId && { userId: filters.userId }),
                    ...(filters?.action && { action: filters.action }),
                    ...(filters?.pageKey && { pageKey: filters.pageKey }),
                    ...(filters?.dateFrom && filters?.dateTo && {
                        createdAt: {
                            gte: filters.dateFrom,
                            lte: filters.dateTo,
                        }
                    }),
                };
                const take = pagination?.pageSize || 50;
                const skip = pagination?.page ? (pagination.page - 1) * take : 0;
                return await ctx.prisma.auditLog.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take,
                    skip,
                    include: { user: true }
                });
            }
        });
    }
});
// Note: AuditLogFiltersInput and PaginationInput need to be defined in types
