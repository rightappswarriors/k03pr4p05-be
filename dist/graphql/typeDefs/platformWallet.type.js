import { objectType } from 'nexus';
export const PlatformWallet = objectType({
    name: 'PlatformWallet',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('currency');
        t.nonNull.float('balance');
        t.nonNull.float('heldBalance');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
    },
});
export const PlatformWalletLedgerEntry = objectType({
    name: 'PlatformWalletLedgerEntry',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('walletId');
        t.nonNull.field('type', { type: 'LedgerEntryType' });
        t.nonNull.field('sourceType', { type: 'PlatformLedgerSourceType' });
        t.nullable.string('referenceId');
        t.nullable.string('paymentTransactionId');
        t.nonNull.float('amount');
        t.nonNull.float('balanceAfter');
        t.nullable.string('description');
        t.nonNull.field('environment', { type: 'Environment' });
        t.nonNull.dateTime('createdAt');
    },
});
