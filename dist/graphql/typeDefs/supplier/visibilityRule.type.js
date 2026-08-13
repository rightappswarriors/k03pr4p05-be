import { objectType } from 'nexus';
export const VisibilityRule = objectType({
    name: 'VisibilityRule',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('agentTier');
        t.nonNull.field('supplierPlan', {
            type: 'SubscriptionPlan',
        });
        t.nonNull.boolean('isVisible');
        t.nonNull.float('rankBoost');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
    },
});
