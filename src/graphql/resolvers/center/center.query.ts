import { extendType, intArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS, requireAny } from '../../../lib/permissions.map.js'

export const centerQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('getCenters', {
      type: 'Center',

      resolve: async (_, __, ctx) => {
        requireAuth(ctx)

        requireRole(ctx, ['OWNER', 'STAFF'])

        requireAny(ctx, PAGE_PERMISSIONS.dashboard.view, PAGE_PERMISSIONS.masterFile.view)
        const orgId = Number(ctx.user.orgId)
        return ctx.prisma.center.findMany({
          where: { orgId }
        })

      }
    })
  }
})