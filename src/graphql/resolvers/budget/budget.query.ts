import { arg, extendType, intArg, nullable } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'

export const budgetQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('budgetEntries', {
      type: 'Budget',
      args: {
        year: nullable(intArg()),
      },
      resolve: async (_, { year }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])

        const orgId = Number(ctx.user?.orgId)
        return ctx.prisma.budget.findMany({
          where: {
            orgId,
            ...(year ? { year } : {}),
          },
          orderBy: {
            year: 'desc',
          },
        })
      },
    })

    t.field('budgetEntry', {
      type: 'Budget',
      args: {
        id: intArg(),
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])

        const orgId = Number(ctx.user?.orgId)
        return ctx.prisma.budget.findFirst({
          where: {
            id,
            orgId,
          },
        })
      },
    })
  },
})
