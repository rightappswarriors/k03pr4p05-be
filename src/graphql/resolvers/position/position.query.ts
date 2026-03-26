import { extendType, intArg } from 'nexus'

export const positionQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('positions', {
      type: 'Position',
      args: {
        orgId: intArg()
      },
      resolve: async (_, { orgId }, ctx) => {
        return ctx.prisma.position.findMany({
          where: { orgId }
        })
      }
    })
    t.field('position', {
      type: 'Position',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.position.findUnique({
          where: { id }
        })
      }
    })
  }
})