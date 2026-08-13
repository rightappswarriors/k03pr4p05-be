import { objectType } from 'nexus';

export const FeeRule = objectType({
  name: 'FeeRule',
  definition(t) {
    t.nonNull.string('id');

    t.nonNull.field('appliesTo', {
      type: 'FeeApplication',
    });

    t.nullable.string('category');
    t.nullable.string('unitType');

    t.nonNull.field('rateType', {
      type: 'FeeRateType',
    });

    t.nonNull.float('rate');
    t.nullable.float('tierModifier');

    t.nonNull.dateTime('effectiveFrom');
    t.nullable.dateTime('effectiveTo');

    t.nonNull.boolean('isActive');

    t.nonNull.dateTime('createdAt');
    t.nonNull.dateTime('updatedAt');
    t.nullable.dateTime('deletedAt');
  },
});