import { objectType } from 'nexus';
export const MandateTransaction = objectType({
    name: 'MandateTransaction',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('mandateId');
        t.nonNull.string('offerId');
        t.nonNull.string('agentId');
        t.nonNull.int('supplierOrgId');
        t.nonNull.float('amount');
        t.nonNull.float('feeAmount');
        t.nonNull.float('netAmount');
        t.nonNull.field('settlementType', {
            type: 'SettlementType',
        });
        t.nonNull.field('status', {
            type: 'MandateTransactionStatus',
        });
        t.nullable.string('paymentTransactionId');
        t.nullable.string('linkedPoId');
        t.nonNull.field('environment', {
            type: 'Environment',
        });
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('mandate', {
            type: 'Mandate',
        });
        t.nonNull.field('supplierOrg', {
            type: 'Organization',
        });
        t.nullable.field('escrow', {
            type: 'EscrowRelease',
        });
    },
});
