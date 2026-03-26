import { extendType, intArg } from 'nexus'

export const accountTitleQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('accountTitles', {
      type: 'AccountTitle',
      args: {
        orgId: intArg()
      },
      resolve: async (_, { orgId }, ctx) => {
        return ctx.prisma.accountTitle.findMany({
          where: { orgId }
        })
      }
    })
    t.field('accountTitle', {
      type: 'AccountTitle',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.accountTitle.findUnique({
          where: { id }
        })
      }
    })
  }
})