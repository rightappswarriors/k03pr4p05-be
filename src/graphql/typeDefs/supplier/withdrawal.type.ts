import { objectType } from 'nexus';

export const Withdrawal = objectType({
  name: 'Withdrawal',
  definition(t) {
    t.nonNull.int('id');

    t.nonNull.int('walletId');
    t.nonNull.int('payoutMethodId');

    t.nonNull.float('amount');

    t.nonNull.field('status', {
      type: 'WithdrawalStatus',
    });

    t.nonNull.int('requestedById');
    t.nullable.int('approvedById');

    t.nonNull.dateTime('requestedAt');
    t.nullable.dateTime('approvedAt');
    t.nullable.dateTime('completedAt');

    t.nullable.string('rejectionReason');

    t.nonNull.field('environment', {
      type: 'Environment',
    });

    t.nullable.dateTime('deletedAt');

    t.nonNull.field('wallet', {
      type: 'Wallet',
    });

    t.nonNull.field('payoutMethod', {
      type: 'PayoutMethod',
    });
  },
});