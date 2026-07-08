import { objectType } from 'nexus';
export const BusinessVerification = objectType({
    name: 'BusinessVerification',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
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
        t.nullable.string('notes');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('organization', {
            type: 'Organization',
        });
    },
});
