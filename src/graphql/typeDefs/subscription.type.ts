// graphql/types/Subscription.type.ts
import { objectType, enumType } from 'nexus';


export const SubscriptionType = objectType({
  name: 'Subscription',
  definition(t) {
    t.nonNull.int('id');
    t.nonNull.int('orgId');
    t.nonNull.field('plan', { type: 'SubscriptionPlan' });
    t.nullable.string('expiresAt');   // ISO string from DateTime
    t.nullable.string('features');    // JSON stringified
    t.nonNull.string('createdAt');
    t.field('org', {
      type: 'Organization',
      resolve: (parent, _, ctx) =>
        ctx.prisma.organization.findUnique({ where: { id: parent.orgId } }),
    });
  },
});

// Lightweight org type for subscription context
export const OrgBasicType = objectType({
  name: 'OrgBasic',
  definition(t) {
    t.nonNull.int('id');
    t.nonNull.string('name');
    t.nullable.string('email');
    t.nullable.string('profilePhoto');
  },
});

// Paginated list wrapper
export const SubscriptionListType = objectType({
  name: 'SubscriptionList',
  definition(t) {
    t.nonNull.list.nonNull.field('items', { type: 'Subscription' });
    t.nonNull.int('total');
    t.nonNull.int('page');
    t.nonNull.int('pageSize');
  },
});