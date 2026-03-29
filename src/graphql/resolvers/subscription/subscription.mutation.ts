import { extendType, intArg, nonNull, arg } from 'nexus'
import { createSubscription as createSubscriptionService, updateSubscription as updateSubscriptionService } from '../../../services/subscriptionService.js'

export const subscriptionMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createSubscription', {
      type: 'Subscription',
      args: {
        orgId: nonNull(intArg()),
        plan: nonNull(arg({ type: 'SubscriptionPlan' }))
      },
      resolve: async (_, { orgId, plan }, ctx) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Subscription] Creating subscription for orgId: ${orgId}, plan: ${plan}`)
        }
        try {
          const subscription = await createSubscriptionService(Number(orgId), plan)
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Subscription] ✅ Created subscription:`, subscription)
          }
          return subscription
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Subscription] ❌ Failed to create subscription:`, error)
          }
          throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    })
    t.field('updateSubscription', {
      type: 'Subscription',
      args: {
        orgId: nonNull(intArg()),
        plan: nonNull(arg({ type: 'SubscriptionPlan' }))
      },
      resolve: async (_, { orgId, plan }, ctx) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Subscription] Updating subscription for orgId: ${orgId}, plan: ${plan}`)
        }
        try {
          const subscription = await updateSubscriptionService(Number(orgId), plan)
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Subscription] ✅ Updated subscription:`, subscription)
          }
          return subscription
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Subscription] ❌ Failed to update subscription:`, error)
          }
          throw new Error(`Failed to update subscription: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    })
  }
})