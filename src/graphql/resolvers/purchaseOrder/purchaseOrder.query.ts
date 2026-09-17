import { extendType, nonNull, stringArg, intArg, nullable, list, arg, objectType } from 'nexus'
import { markConversationNotificationsRead } from '../../../services/notification.service.js'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js'
import { requireSupplierOrganizationScope, requireSupplierPurchaseOrderScope } from '../../../lib/supplierScope.js'
import { isDeliveryAgreementDeadlineExpired, reconcileExpiredDeliveryAgreement } from '../../../services/purchaseOrderDeliveryAgreement.service.js'

export const SupplierPurchaseOrderSummary = objectType({
  name: 'SupplierPurchaseOrderSummary',
  definition(t) {
    t.nonNull.int('total')
    t.nonNull.int('pending')
    t.nonNull.int('accepted')
    t.nonNull.int('delivered')
  },
})

export const SupplierPurchaseOrderPage = objectType({
  name: 'SupplierPurchaseOrderPage',
  definition(t) {
    t.nonNull.list.nonNull.field('items', { type: 'PurchaseOrder' })
    t.nonNull.int('total')
    t.nonNull.int('page')
    t.nonNull.int('pageSize')
    t.nonNull.boolean('hasNextPage')
    t.nonNull.field('summary', { type: 'SupplierPurchaseOrderSummary' })
  },
})

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
        PAGE_PERMISSIONS.supplierPurchaseOrders.view(ctx)
        requireSupplierOrganizationScope(ctx, supplierOrgId)
        return ctx.prisma.purchaseOrder.findMany({
          where: {
            supplierOrgId,
            ...(status ? { status } : {}),
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            
          },
          orderBy: { createdAt: 'desc' },
        })
      },
    })

    t.nonNull.field('supplierPurchaseOrderPage', {
      type: 'SupplierPurchaseOrderPage',
      args: {
        supplierOrgId: nonNull(intArg()),
        status: nullable(arg({ type: 'POStatus' })),
        page: intArg(),
        pageSize: intArg(),
      },
      resolve: async (_, { supplierOrgId, status, page, pageSize }, ctx) => {
        PAGE_PERMISSIONS.supplierPurchaseOrders.view(ctx)
        requireSupplierOrganizationScope(ctx, supplierOrgId)
        const safePage = Math.max(1, page ?? 1)
        const safePageSize = Math.min(100, Math.max(1, pageSize ?? 20))
        const where = {
          supplierOrgId,
          ...(status ? { status } : {}),
        }
        const [items, total, statusCounts] = await Promise.all([
          ctx.prisma.purchaseOrder.findMany({
            where,
            include: {
              lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
              delivery: true,
              buyerOrg: true,
            },
            orderBy: { createdAt: 'desc' },
            skip: (safePage - 1) * safePageSize,
            take: safePageSize,
          }),
          ctx.prisma.purchaseOrder.count({ where }),
          ctx.prisma.purchaseOrder.groupBy({
            by: ['status'],
            where: { supplierOrgId },
            _count: { _all: true },
          }),
        ])
        const counts = new Map<string, number>(
          statusCounts.map((entry) => [entry.status, Number(entry._count._all)] as const),
        )
        return {
          items,
          total,
          page: safePage,
          pageSize: safePageSize,
          hasNextPage: safePage * safePageSize < total,
          summary: {
            total: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
            pending: counts.get('PENDING') ?? 0,
            accepted: (counts.get('SUPPLIER_ACCEPTED') ?? 0) + (counts.get('ACCEPTED') ?? 0),
            delivered: counts.get('DELIVERED') ?? 0,
          },
        }
      },
    })

    t.nonNull.list.nonNull.field('purchaseOrdersForBuyer', {
      type: 'PurchaseOrder',
      args: {
        buyerOrgId: nonNull(intArg()),
        status: nullable(arg({ type: 'POStatus' })),
      },
      resolve: async (_, { buyerOrgId, status }, ctx) => {
        requireAuth(ctx)
        if (Number(ctx.user?.orgId) !== buyerOrgId) throw new Error('Resource not found.')
        return ctx.prisma.purchaseOrder.findMany({
          where: {
            buyerOrgId,
            ...(status ? { status } : {}),
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            supplierOrg: true,
        
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
        requireAuth(ctx)
        let po = await ctx.prisma.purchaseOrder.findUnique({
          where: { id },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
          //  outlet: true,
            Conversation: {
              include: {
                ConversationParticipant: { include: { Agent: true, Organization: true } },
                ConversationMessage: { orderBy: { createdAt: 'asc' }, include: { Agent: true, Organization: true } },
              },
            },
          },
        });
        if (!po) return null
        const currentOrgId = Number(ctx.user?.orgId)
        if (po.supplierOrgId === currentOrgId) PAGE_PERMISSIONS.supplierPurchaseOrders.view(ctx)
        else if (po.buyerOrgId !== currentOrgId) throw new Error('Resource not found.')

        if (po.deliveryDateAgreementStatus === 'PENDING_BUYER' && isDeliveryAgreementDeadlineExpired(po.deliveryDateResponseDeadlineAt)) {
          await reconcileExpiredDeliveryAgreement(ctx.prisma, { purchaseOrderId: po.id })
          po = await ctx.prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
              lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
              delivery: true,
              buyerOrg: true,
              supplierOrg: true,
              Conversation: {
                include: {
                  ConversationParticipant: { include: { Agent: true, Organization: true } },
                  ConversationMessage: { orderBy: { createdAt: 'asc' }, include: { Agent: true, Organization: true } },
                },
              },
            },
          })
          if (!po) return null
        }

        // Mark notifications tied to this PO's conversation as read for the authenticated user's org (best-effort)
        if (po?.Conversation?.id && ctx.user?.orgId) {
          void markConversationNotificationsRead(po.Conversation.id, ctx.user.orgId).catch(() => {});
        }

        return po;
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
        requireAuth(ctx)
        const po = await ctx.prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { supplierOrgId: true, buyerOrgId: true } })
        if (!po) throw new Error('Resource not found.')
        const currentOrgId = Number(ctx.user?.orgId)
        if (po.supplierOrgId === currentOrgId) {
          PAGE_PERMISSIONS.supplierOrderTimeline.view(ctx)
          await requireSupplierPurchaseOrderScope(ctx, poId)
        } else if (po.buyerOrgId !== currentOrgId) throw new Error('Resource not found.')
        return ctx.prisma.auditLog.findMany({
          where: { recordType: 'PurchaseOrder', recordId: poId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      },
    })
  },
})
