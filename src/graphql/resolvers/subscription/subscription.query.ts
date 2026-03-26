import { extendType, intArg } from 'nexus'

export const subscriptionQuery = extendType({
  type: 'Query',
  definition(t) {
    t.field('subscription', {
      type: 'Subscription',
      args: { orgId: intArg() },
      resolve: async (_, { orgId }, ctx) => {
        return ctx.prisma.subscription.findUnique({ where: { orgId } })
      }
    })
  }
})