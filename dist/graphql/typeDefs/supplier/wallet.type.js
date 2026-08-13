import { objectType } from 'nexus';
export const Wallet = objectType({
    name: 'Wallet',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('orgId');
        t.nonNull.float('balance');
        t.nonNull.float('heldBalance');
        t.nonNull.string('currency');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('organization', {
            type: 'Organization',
        });
        t.nonNull.list.nonNull.field('ledgerEntries', {
            type: 'WalletLedgerEntry',
        });
        t.nonNull.list.nonNull.field('withdrawals', {
            type: 'Withdrawal',
        });
    },
});
