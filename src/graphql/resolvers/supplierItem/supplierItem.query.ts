import { extendType, nonNull, stringArg, intArg, nullable } from 'nexus'

export const SupplierItemsQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nullable.field('supplierCatalog', {
      type: 'SupplierCatalog',
      resolve: async (_, __, ctx) => {
        const organizationId = ctx.user?.orgId
        return ctx.prisma.supplierCatalog.findUnique({
          where: { organizationId },
          include: { items: { where: { isActive: true }, include: { priceTiers: true } } },
        })
      },
    })

    t.nonNull.list.nonNull.field('supplierItems', {
      type: 'SupplierItem',
      args: {
        catalogId: nonNull(stringArg()),
      },
      resolve: async (_, { catalogId }, ctx) => {
        return ctx.prisma.supplierItem.findMany({
          where: { catalogId, isActive: true },
          include: { priceTiers: true },
          orderBy: { name: 'asc' },
        })
      },
    })

    t.nullable.field('supplierItem', {
      type: 'SupplierItem',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.supplierItem.findUnique({
          where: { id },
          include: { priceTiers: true },
        })
      },
    })

    t.nullable.field('supplierDashboard', {
      type: 'SupplierDashboardStats',
      args: {
        supplierOrgId: nonNull(intArg()),
      },
      resolve: async (_, { supplierOrgId }, ctx) => {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // Pull the supplier's active catalog units first — used to scope which
        // open mandates are actually relevant to them (a fuel supplier shouldn't
        // see mandates for, say, office supplies).
        const catalog = await ctx.prisma.supplierCatalog.findUnique({
          where: { organizationId: supplierOrgId },
          include: { items: { where: { isActive: true }, select: { unit: true } } },
        })
        const activeUnits = [...new Set((catalog?.items ?? []).map((i: any) => i.unit))]

        const [
          newPOs,
          pendingDeliveries,
          fulfilledToday,
          pipelinePOs,
          openMandatesCount,
          myPendingMandateOffers,
          myAcceptedMandateOffers,
          wallet,
        ] = await Promise.all([
          ctx.prisma.purchaseOrder.count({
            where: { supplierOrgId, status: 'PENDING' },
          }),
          ctx.prisma.delivery.count({
            where: {
              po: { supplierOrgId },
              status: { in: ['SCHEDULED', 'IN_TRANSIT'] },
            },
          }),
          ctx.prisma.purchaseOrder.count({
            where: {
              supplierOrgId,
              status: 'DELIVERED',
              updatedAt: { gte: startOfDay },
            },
          }),
          ctx.prisma.purchaseOrder.findMany({
            where: {
              supplierOrgId,
              status: { in: ['PENDING', 'ACCEPTED', 'IN_TRANSIT'] },
            },
            select: { totalAmount: true },
          }),
          activeUnits.length > 0
            ? ctx.prisma.mandate.count({
                where: { status: 'SEARCHING', unitType: { in: activeUnits }, deletedAt: null },
              })
            : Promise.resolve(0),
          ctx.prisma.mandateOffer.count({
            where: { supplierOrgId, status: 'PENDING', deletedAt: null },
          }),
          ctx.prisma.mandateOffer.count({
            where: { supplierOrgId, status: 'ACCEPTED', deletedAt: null },
          }),
          ctx.prisma.wallet.findUnique({ where: { orgId: supplierOrgId } }),
        ])

        const duePayments = pipelinePOs.reduce((sum:any, po: any) => sum + po.totalAmount, 0)

        return {
          newPOs,
          pendingDeliveries,
          fulfilledToday,
          duePayments,
          openMandatesCount,
          myPendingMandateOffers,
          myAcceptedMandateOffers,
          catalogItemCount: catalog?.items.length ?? 0,
          walletBalance: wallet?.balance ?? 0,
          walletHeldBalance: wallet?.heldBalance ?? 0,
        }
      },
    })
  },
})