import { extendType, nonNull, stringArg, intArg, nullable } from 'nexus'

export const ReceivedItemMapMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('mapReceivedItem', {
      type: 'ReceivedItemMap',
      args: {
        supplierItemId: nonNull(stringArg()),
        buyerOrgId: nonNull(intArg()),
        itemId: nonNull(intArg()),
        outletId: nullable(intArg()),
      },
      resolve: async (_, { supplierItemId, buyerOrgId, itemId, outletId }, ctx) => {
        return ctx.prisma.receivedItemMap.upsert({
          where: {
            supplierItemId_buyerOrgId_outletId: {
              supplierItemId,
              buyerOrgId,
              outletId: outletId ?? null,
            },
          },
          create: { supplierItemId, buyerOrgId, itemId, outletId },
          update: { itemId },
          include: {
            supplierItem: { include: { priceTiers: true } },
            item: true,
            outlet: true,
          },
        })
      },
    })

    t.nonNull.field('unmapReceivedItem', {
      type: 'ReceivedItemMap',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.receivedItemMap.delete({
          where: { id },
          include: {
            supplierItem: { include: { priceTiers: true } },
            item: true,
            outlet: true,
          },
        })
      },
    })
  },
})
