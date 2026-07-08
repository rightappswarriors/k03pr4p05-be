import { objectType } from 'nexus';
export const WalletLedgerEntry = objectType({
    name: 'WalletLedgerEntry',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('walletId');
        t.nonNull.field('type', {
            type: 'LedgerEntryType',
        });
        t.nonNull.field('sourceType', {
            type: 'LedgerSourceType',
        });
        t.nullable.string('referenceId');
        t.nonNull.float('amount');
        t.nonNull.float('balanceAfter');
        t.nonNull.field('status', {
            type: 'LedgerEntryStatus',
        });
        t.nonNull.field('environment', {
            type: 'Environment',
        });
        t.nonNull.dateTime('createdAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('wallet', {
            type: 'Wallet',
        });
    },
});
