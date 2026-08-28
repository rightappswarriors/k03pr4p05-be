import { extendType, nonNull, stringArg } from 'nexus';
// Development-only verification seam. Production confirmation must be a
// signature-verified provider webhook; no agent/supplier mutation can confirm.
export const developmentPaymentConfirmationMutation = extendType({
    type: 'Mutation', definition(t) {
        t.nonNull.field('confirmPaymentForDevelopment', {
            type: 'PaymentTransaction', args: { paymentTransactionId: nonNull(stringArg()) },
            resolve: async () => {
                throw new Error('This legacy development confirmation path is disabled. Use adminConfirmSandboxPaymentReconciliation.');
            },
        });
    },
});
