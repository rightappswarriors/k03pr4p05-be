import { extendType, intArg } from 'nexus'

export const subscriptionMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createSubscription', {
      type: 'Subscription',
      args: {
        orgId: intArg(),
        plan: 'SubscriptionPlan'
      },
      resolve: async (_, { orgId, plan }, ctx) => {
        return ctx.prisma.subscription.create({
          data: { orgId, plan }
        })
      }
    })
    t.field('updateSubscription', {
      type: 'Subscription',
      args: {
        orgId: intArg(),
        plan: 'SubscriptionPlan'
      },
      resolve: async (_, { orgId, plan }, ctx) => {
        return ctx.prisma.subscription.update({
          where: { orgId },
          data: { plan }
        })
      }
    })
  }
})