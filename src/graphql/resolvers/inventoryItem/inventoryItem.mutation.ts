import { extendType, intArg, stringArg, floatArg } from 'nexus'

export const inventoryItemMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createInventoryItem', {
      type: 'InventoryItem',
      args: {
        orgId: intArg(),
        name: stringArg(),
        quantity: intArg(),
        price: floatArg(),
        itemGroupId: intArg()
      },
      resolve: async (_, { orgId, name, quantity, price, itemGroupId }, ctx) => {
        return ctx.prisma.inventoryItem.create({
          data: { orgId, name, quantity, price, itemGroupId }
        })
      }
    })
    t.field('updateInventoryItem', {
      type: 'InventoryItem',
      args: {
        id: intArg(),
        name: stringArg(),
        quantity: intArg(),
        price: floatArg(),
        itemGroupId: intArg()
      },
      resolve: async (_, { id, name, quantity, price, itemGroupId }, ctx) => {
        return ctx.prisma.inventoryItem.update({
          where: { id },
          data: { name, quantity, price, itemGroupId }
        })
      }
    })
    t.field('deleteInventoryItem', {
      type: 'InventoryItem',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.inventoryItem.delete({
          where: { id }
        })
      }
    })
  }
})