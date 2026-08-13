import { objectType } from 'nexus';
export const PaymentTransaction = objectType({
    name: 'PaymentTransaction',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('provider', {
            type: 'PaymentGatewayProvider',
        });
        t.nonNull.field('environment', {
            type: 'Environment',
        });
        t.nullable.string('gatewayReference');
        t.nonNull.float('amount');
        t.nonNull.float('feeAmount');
        t.nonNull.field('status', {
            type: 'PaymentTransactionStatus',
        });
        t.nonNull.field('relatedType', {
            type: 'PaymentRelatedType',
        });
        t.nonNull.string('relatedId');
        t.nullable.int('payerOrgId');
        t.nullable.string('payerAgentId');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
    },
});
