import { objectType } from 'nexus';

export const Mandate = objectType({
  name: 'Mandate',
  definition(t) {
    t.nonNull.string('id');
    t.nonNull.string('agentId');

    t.nonNull.string('category');
    t.nonNull.string('unitType');

    t.nonNull.float('quantity');
    t.nullable.float('targetPrice');

    t.nullable.float('latitude');
    t.nullable.float('longitude');
    t.nullable.float('radiusKm');

    t.nonNull.field('status', {
      type: 'MandateStatus',
    });

    t.nullable.string('notes');

    t.nonNull.dateTime('createdAt');
    t.nonNull.dateTime('updatedAt');
    t.nullable.dateTime('deletedAt');

    t.nonNull.field('agent', {
      type: 'Agent',
    });

    t.nonNull.list.nonNull.field('offers', {
      type: 'MandateOffer',
    });

    t.nullable.field('transaction', {
      type: 'MandateTransaction',
    });
  },
});