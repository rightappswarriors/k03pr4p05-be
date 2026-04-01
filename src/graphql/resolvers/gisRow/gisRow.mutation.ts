import { extendType, intArg, stringArg, floatArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'

export const gisRowMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createGISRow', {
      type: 'GISRow',
      args: {
        orgId: intArg(),
        accountTitleId: intArg(),
        amount: floatArg(),
        description: stringArg()
      },
      resolve: async (_, { orgId, accountTitleId, amount, description }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])
        return ctx.prisma.gISRow.create({
          data: { orgId, accountTitleId, amount, description }
        })
      }
    })
    t.field('updateGISRow', {
      type: 'GISRow',
      args: {
        id: intArg(),
        accountTitleId: intArg(),
        amount: floatArg(),
        description: stringArg()
      },
      resolve: async (_, { id, accountTitleId, amount, description }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])
        return ctx.prisma.gISRow.update({
          where: { id },
          data: { accountTitleId, amount, description }
        })
      }
    })
    t.field('deleteGISRow', {
      type: 'GISRow',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.gISRow.delete({
          where: { id }
        })
      }
    })
  }
})