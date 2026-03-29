import { extendType, intArg } from 'nexus';
import { createSubscription as createSubscriptionService, updateSubscription as updateSubscriptionService } from '../../../services/subscriptionService.js';
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
                return createSubscriptionService(Number(orgId), plan);
            }
        });
        t.field('updateSubscription', {
            type: 'Subscription',
            args: {
                orgId: intArg(),
                plan: 'SubscriptionPlan'
            },
            resolve: async (_, { orgId, plan }, ctx) => {
                return updateSubscriptionService(Number(orgId), plan);
            }
        });
    }
});
