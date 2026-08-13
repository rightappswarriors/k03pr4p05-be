import { objectType } from 'nexus';

export const AgentVerification = objectType({
  name: 'AgentVerification',
  definition(t) {
    t.nonNull.string('id');
    t.nonNull.string('agentId');

    t.nonNull.field('documentType', {
      type: 'DocumentType',
    });

    t.nonNull.string('fileUrl');

    t.nonNull.field('status', {
      type: 'VerificationStatus',
    });

    t.nullable.int('reviewedById');
    t.nullable.dateTime('reviewedAt');

    t.nonNull.field('environment', {
      type: 'Environment',
    });

    t.nonNull.dateTime('createdAt');
    t.nullable.dateTime('deletedAt');

    t.nonNull.field('agent', {
      type: 'Agent',
    });
  },
});