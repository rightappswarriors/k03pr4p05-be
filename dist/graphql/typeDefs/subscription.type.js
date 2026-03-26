import { objectType } from 'nexus';
export const Subscription = objectType({
    name: 'Subscription',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('orgId');
        t.nonNull.field('plan', { type: 'SubscriptionPlan' });
        t.nullable.dateTime('expiresAt');
        t.nullable.field('features', { type: 'Json' });
        t.nonNull.dateTime('createdAt');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.subscription.findUnique({ where: { id: parent.id } }).org();
            }
        });
    }
});
