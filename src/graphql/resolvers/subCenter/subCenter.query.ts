import { extendType, intArg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS, requireAny } from '../../../lib/permissions.map.js'

export const subCenterQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('subCenters', {
      type: 'SubCenter',
      args: {
        orgId: intArg()
      },

      resolve: async (_, { orgId }, ctx) => {
        requireAuth(ctx)
        requireAny(ctx, PAGE_PERMISSIONS.masterFile.view, PAGE_PERMISSIONS.dashboard.view)
        
        return ctx.prisma.subCenter.findMany({
          where: { orgId }
        })
      }
    })
    t.field('subCenter', {
      type: 'SubCenter',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        PAGE_PERMISSIONS.masterFile.view(ctx)
        return ctx.prisma.subCenter.findUnique({
          where: { id }
        })
      }
    })
  }
})