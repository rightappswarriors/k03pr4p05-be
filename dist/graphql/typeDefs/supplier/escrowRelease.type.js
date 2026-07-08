import { objectType } from 'nexus';
export const EscrowRelease = objectType({
    name: 'EscrowRelease',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('mandateTransactionId');
        t.nullable.string('buyerProofUrl');
        t.nullable.string('sellerProofUrl');
        t.nullable.dateTime('buyerConfirmedAt');
        t.nullable.dateTime('sellerConfirmedAt');
        t.nullable.dateTime('autoReleaseAt');
        t.nullable.dateTime('releasedAt');
        t.nonNull.field('disputeStatus', {
            type: 'DisputeStatus',
        });
        t.nullable.string('disputeReason');
        t.nullable.int('resolvedById');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nonNull.field('mandateTransaction', {
            type: 'MandateTransaction',
        });
    },
});
