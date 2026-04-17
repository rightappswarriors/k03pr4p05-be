import { extendType, intArg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'

export const centerQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('getCenters', {
      type: 'Center',
      resolve: async (_, __, ctx) => {
        requireAuth(ctx)
        const orgId = Number(ctx.user.orgId)
        return ctx.prisma.center.findMany({
          where: { orgId }
        })
   
      }
    })
  }
})