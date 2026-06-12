import { arg, extendType, floatArg, intArg, stringArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'

export const budgetMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createBudgetEntry', {
      type: 'Budget',
      args: {
        year: intArg(),
        account: stringArg(),
        begBal: floatArg(),
        months: arg({ type: 'Json' }),
      },
      resolve: async (_, { year, account, begBal, months }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])

        const orgId = Number(ctx.user?.orgId)
        return ctx.prisma.budget.create({
          data: {
            year,
            account,
            begBal,
            months,
            orgId,
            userId: ctx.user?.id ? Number(ctx.user.id) : undefined,
          },
        })
      },
    })

    t.field('updateBudgetEntry', {
      type: 'Budget',
      args: {
        id: intArg(),
        year: intArg(),
        account: stringArg(),
        begBal: floatArg(),
        months: arg({ type: 'Json' }),
      },
      resolve: async (_, { id, year, account, begBal, months }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])

        const orgId = Number(ctx.user?.orgId)
        const existing = await ctx.prisma.budget.findFirst({
          where: { id, orgId },
        })

        if (!existing) {
          throw new Error('Budget entry not found or access denied')
        }

        return ctx.prisma.budget.update({
          where: { id },
          data: {
            year,
            account,
            begBal,
            months,
          },
        })
      },
    })

    t.field('deleteBudgetEntry', {
      type: 'Budget',
      args: {
        id: intArg(),
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'ADMIN'])

        const orgId = Number(ctx.user?.orgId)
        const existing = await ctx.prisma.budget.findFirst({
          where: { id, orgId },
        })

        if (!existing) {
          throw new Error('Budget entry not found or access denied')
        }

        return ctx.prisma.budget.update({
          where: { id },
          data: { deletedAt: new Date() },
        })
      },
    })
  },
})
