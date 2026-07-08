import { extendType, nonNull, stringArg, intArg, nullable, list, arg, objectType } from 'nexus'

export const PurchaseOrderQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.list.nonNull.field('purchaseOrdersForSupplier', {
      type: 'PurchaseOrder',
      args: {
        supplierOrgId: nonNull(intArg()),
        status: nullable(arg({ type: 'POStatus' })),
      },
      resolve: async (_, { supplierOrgId, status }, ctx) => {
        return ctx.prisma.purchaseOrder.findMany({
          where: {
            supplierOrgId,
            ...(status ? { status } : {}),
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            outlet: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      },
    })

    t.nonNull.list.nonNull.field('purchaseOrdersForBuyer', {
      type: 'PurchaseOrder',
      args: {
        buyerOrgId: nonNull(intArg()),
        status: nullable(arg({ type: 'POStatus' })),
      },
      resolve: async (_, { buyerOrgId, status }, ctx) => {
        return ctx.prisma.purchaseOrder.findMany({
          where: {
            buyerOrgId,
            ...(status ? { status } : {}),
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            supplierOrg: true,
            outlet: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      },
    })

    t.nullable.field('purchaseOrder', {
      type: 'PurchaseOrder',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.purchaseOrder.findUnique({
          where: { id },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
            outlet: true,
          },
        })
      },
    })
  },
})

export const AuditLogEntryType = objectType({
  name: 'AuditLogEntry',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.field('action', { type: 'AuditAction' })
    t.nonNull.field('createdAt', { type: 'DateTime' })
    t.nullable.field('userFullname', {
      type: 'String',
      resolve: async (log, _args, ctx) => {
        const user = await ctx.prisma.user.findUnique({ where: { id: log.userId } })
        return user?.fullname ?? null
      },
    })
  },
})

export const PurchaseOrderActivityQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.list.nonNull.field('purchaseOrderActivity', {
      type: 'AuditLogEntry',
      args: { poId: nonNull(stringArg()) },
      resolve: async (_, { poId }, ctx) => {
        return ctx.prisma.auditLog.findMany({
          where: { recordType: 'PurchaseOrder', recordId: poId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      },
    })
  },
})