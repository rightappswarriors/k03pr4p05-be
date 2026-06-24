import { extendType, intArg } from 'nexus'
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js'

export const inventoryItemQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('inventoryItems', {
      type: 'InventoryItem',
      args: {
        orgId: intArg()
      },
      resolve: async (_, { orgId }, ctx) => {
        PAGE_PERMISSIONS.inventory.view(ctx)
        return ctx.prisma.inventoryItem.findMany({
          where: { orgId }
        })
      }
    })
    t.field('inventoryItem', {
      type: 'InventoryItem',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        PAGE_PERMISSIONS.inventory.view(ctx)
        return ctx.prisma.inventoryItem.findUnique({
          where: { id }
        })
      }
    })
  }
})