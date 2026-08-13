import { objectType } from 'nexus';

export const SystemConfig = objectType({
  name: 'SystemConfig',
  definition(t) {
    t.nonNull.string('id');
    t.nonNull.string('key');

    t.nonNull.json('value');

    t.nullable.string('description');

    t.nonNull.dateTime('updatedAt');

    t.nullable.int('updatedById');

    t.nullable.dateTime('deletedAt');
  },
});