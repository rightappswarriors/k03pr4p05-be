import { extendType, intArg } from 'nexus'
import { requireRole } from '../../../middleware/auth.middleware'

export const accountTitleQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('accountTitles', {
      type: 'AccountTitle',
      args: {
        orgId: intArg()
      },
      resolve: async (_, { orgId }, ctx) => {
        requireRole(ctx, ['OWNER'])
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
        requireRole(ctx, ['OWNER'])
        return ctx.prisma.accountTitle.findUnique({
          where: { id }
        })
      }
    })
  }
})