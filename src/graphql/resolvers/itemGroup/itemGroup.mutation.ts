import { extendType, intArg, stringArg } from 'nexus'

export const itemGroupMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createItemGroup', {
      type: 'ItemGroup',
      args: {
        orgId: intArg(),
        name: stringArg()
      },
      resolve: async (_, { orgId, name }, ctx) => {
        return ctx.prisma.itemGroup.create({
          data: { orgId, name }
        })
      }
    })
    t.field('updateItemGroup', {
      type: 'ItemGroup',
      args: {
        id: intArg(),
        name: stringArg()
      },
      resolve: async (_, { id, name }, ctx) => {
        return ctx.prisma.itemGroup.update({
          where: { id },
          data: { name }
        })
      }
    })
    t.field('deleteItemGroup', {
      type: 'ItemGroup',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.itemGroup.delete({
          where: { id }
        })
      }
    })
  }
})