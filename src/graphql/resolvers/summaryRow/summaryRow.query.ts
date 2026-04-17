import { arg, extendType, intArg, nullable, stringArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'

export const summaryRowQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('summaryRows', {
      type: 'SummaryRow',
      args: {
        startDate: nullable(stringArg()),  // ← was: nullable(arg({ type: "DateTime" }))
        endDate: nullable(stringArg()),
      },
      resolve: async (_, { startDate, endDate }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ['OWNER', 'ADMIN']);
        const orgId = Number(ctx.user?.orgId);
        return ctx.prisma.summaryRow.findMany({  // or summaryRow
          where: {
            orgId,
            ...(startDate || endDate ? {
              createdAt: {
                ...(startDate && { gte: new Date(startDate) }),  // parse string → Date
                ...(endDate && { lte: new Date(endDate) }),
              },
            } : {}),
          },
        });
      },
    })
    t.field('summaryRow', {
      type: 'SummaryRow',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])
        const orgId = Number(ctx.user?.orgId)
        return ctx.prisma.summaryRow.findUnique({
          where: { id, orgId }
        })
      }
    })
  }
})