import { extendType, intArg, stringArg } from 'nexus'

export const placeLocationMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createPlaceLocation', {
      type: 'PlaceLocation',
      args: {
        orgId: intArg(),
        name: stringArg(),
        address: stringArg()
      },
      resolve: async (_, { orgId, name, address }, ctx) => {
        return ctx.prisma.placeLocation.create({
          data: { orgId, name, address }
        })
      }
    })
    t.field('updatePlaceLocation', {
      type: 'PlaceLocation',
      args: {
        id: intArg(),
        name: stringArg(),
        address: stringArg()
      },
      resolve: async (_, { id, name, address }, ctx) => {
        return ctx.prisma.placeLocation.update({
          where: { id },
          data: { name, address }
        })
      }
    })
    t.field('deletePlaceLocation', {
      type: 'PlaceLocation',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.placeLocation.delete({
          where: { id }
        })
      }
    })
  }
})