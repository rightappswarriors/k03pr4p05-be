import { objectType } from 'nexus';
export const Agent = objectType({
    name: 'Agent',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('agentType', { type: 'AgentType' });
        t.nullable.int('organizationId');
        t.nonNull.string('email');
        t.nullable.string('phone');
        t.nonNull.boolean('isVerified');
        t.nonNull.field('verificationStatus', { type: 'VerificationStatus' });
        t.nonNull.string('trustTier');
        t.nonNull.field('environment', { type: 'Environment' });
        t.nonNull.boolean('isDevSeed');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.string('fullname');
        // Personal Info
        t.nullable.dateTime('birthday');
        t.nullable.string('gender');
        t.nullable.string('address');
        t.nullable.string('city');
        t.nullable.string('province');
        t.nullable.string('zipCode');
        t.nullable.string('civilStatus');
        t.nullable.string('emergencyContact');
        // Preferences
        t.nonNull.list.field('interestedIndustries', { type: 'String' });
        t.nonNull.string('experienceLevel');
        // Status
        t.nonNull.field('status', { type: 'AgentStatus' });
        // Relations
        t.nullable.field('organization', { type: 'Organization' });
        t.nonNull.list.nonNull.field('verifications', { type: 'AgentVerification' });
        t.nonNull.list.nonNull.field('mandates', { type: 'Mandate' });
    },
});
