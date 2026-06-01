import { arg, extendType, nonNull, nullable, stringArg, intArg } from "nexus";
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
        requireAuth(ctx)
        requireRole(ctx, ["OWNER"])
        const where = {
          orgId,
          ...(filters?.userId && { userId: filters.userId }),
          ...(filters?.action && { action: filters.action }),
          ...(filters?.pageKey && { pageKey: filters.pageKey }),
          ...((filters?.dateFrom || filters?.dateTo) && {
            createdAt: {
              ...(filters?.dateFrom && { gte: filters.dateFrom }),
              ...(filters?.dateTo && { lte: filters.dateTo }),
            }
          }),
        }
        const take = pagination?.pageSize || 50
        const skip = pagination?.page ? (pagination.page - 1) * take : 0
        return await ctx.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
          include: { user: true }
        })
      }
    })

    t.nonNull.list.nonNull.field("discountAudits", {
      type: "DiscountAuditType",
      args: {
        orgId: nonNull(intArg()),
        filters: nullable(arg({ type: "DiscountAuditFiltersInput" })),
        pagination: nullable(arg({ type: "PaginationInput" })),
      },
      resolve: async (parent, { orgId, filters, pagination }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ["OWNER", "ADMIN", "MANAGER", "STAFF"])
        const where: any = {
          orgId,
          ...(filters?.customerId && { customerId: filters.customerId }),
          ...(filters?.oscaGovId && { oscaGovId: filters.oscaGovId }),
          ...(filters?.itemId && { itemId: filters.itemId }),
          ...(filters?.discountType && { discountType: filters.discountType }),
          ...(typeof filters?.isVoided === "boolean" && { isVoided: filters.isVoided }),
          ...(filters?.transactionType === "Transaction" && { transactionId: { not: null } }),
          ...(filters?.transactionType === "SalesOrder" && { salesOrderId: { not: null } }),
          ...(filters?.transactionType === "KompraOrder" && { kompraOrderId: { not: null } }),
          ...((filters?.dateFrom || filters?.dateTo) && {
            createdAt: {
              ...(filters?.dateFrom && { gte: filters.dateFrom }),
              ...(filters?.dateTo && { lte: filters.dateTo }),
            }
          }),
        }
        const take = pagination?.pageSize || 50
        const skip = pagination?.page ? (pagination.page - 1) * take : 0
        return await ctx.prisma.discountAudit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
          include: { user: true, item: true }
        })
      }
    })
  }
})

// Note: AuditLogFiltersInput and PaginationInput need to be defined in types
