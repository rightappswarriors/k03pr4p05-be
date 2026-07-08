import { objectType } from 'nexus';
export const Agent = objectType({
    name: 'Agent',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('agentType', {
            type: 'AgentType',
        });
        t.nullable.int('organizationId');
        t.nonNull.string('fullname');
        t.nonNull.string('email');
        t.nullable.string('phone');
        // Be careful exposing this in your GraphQL API.
        // Remove this field if clients should never receive password hashes.
        t.nonNull.string('passwordHash');
        t.nonNull.boolean('isVerified');
        t.nonNull.field('verificationStatus', {
            type: 'VerificationStatus',
        });
        t.nonNull.string('trustTier');
        t.nonNull.field('environment', {
            type: 'Environment',
        });
        t.nonNull.boolean('isDevSeed');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nullable.field('organization', {
            type: 'Organization',
        });
        t.nonNull.list.nonNull.field('verifications', {
            type: 'AgentVerification',
        });
        t.nonNull.list.nonNull.field('mandates', {
            type: 'Mandate',
        });
    },
});
