import { objectType } from 'nexus';

export const PaymentGatewayCredential = objectType({
  name: 'PaymentGatewayCredential',
  definition(t) {
    t.nonNull.int('id');

    t.nullable.int('orgId');

    t.nonNull.field('provider', {
      type: 'PaymentGatewayProvider',
    });

    t.nonNull.field('environment', {
      type: 'Environment',
    });

    t.nullable.string('publicKey');

    // Consider omitting this from the GraphQL schema since it contains
    // encrypted secrets that should never be returned by the API.
    //t.nonNull.string('secretKeyEncrypted');

    t.nonNull.boolean('isActive');

    t.nonNull.dateTime('createdAt');
    t.nonNull.dateTime('updatedAt');
    t.nullable.dateTime('deletedAt');

    t.nullable.field('organization', {
      type: 'Organization',
    });
  },
});