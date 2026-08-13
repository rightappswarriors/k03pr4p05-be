import { arg, extendType, intArg, nullable, stringArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS, requireAny } from '../../../lib/permissions.map.js';

export const gisRowQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('gisRows', {
      type: 'GISRow',
      args: {
        startDate: nullable(stringArg()),  // ← was: nullable(arg({ type: "DateTime" }))
        endDate: nullable(stringArg()),
      },
      resolve: async (_, { startDate, endDate }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ['OWNER', 'ADMIN', 'STAFF']);
        requireAny(ctx, PAGE_PERMISSIONS.dashboard.view, PAGE_PERMISSIONS.finance.view)
      
        const orgId = Number(ctx.user?.orgId);
        return ctx.prisma.gISRow.findMany({  // or summaryRow
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
    t.field('gisRow', {
      type: 'GISRow',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF'])
        PAGE_PERMISSIONS.dashboard.view(ctx)
        const orgId = Number(ctx.user?.orgId)
        return ctx.prisma.gISRow.findUnique({
          where: { id, orgId }
        })
      }
    })
  }
})