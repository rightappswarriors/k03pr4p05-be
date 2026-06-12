import { extendType, intArg, stringArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'

export const centerMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createCenter', {
      type: 'Center',
      args: {
        label: stringArg()
      },
      resolve: async (_, { label }, ctx) => {
        requireAuth(ctx)
        const orgId = Number(ctx.user.orgId)
        return ctx.prisma.center.create({
          data: { orgId, label }
        })
      }
    })
    t.field('updateCenter', {
      type: 'Center',
      args: {
        id: intArg(),
        label: stringArg()
      },
      resolve: async (_, { id, label }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.center.update({
          where: { id },
          data: { label }
        })
      }
    })
    t.field('deleteCenter', {
      type: 'Center',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.center.update({
          where: { id },
          data: { deletedAt: new Date() },
        })
      }
    })
  }
})

