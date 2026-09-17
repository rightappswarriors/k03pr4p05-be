import { objectType } from 'nexus';
export const Wallet = objectType({
    name: 'Wallet',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('orgId');
        t.nonNull.field('environment', { type: 'Environment' });
        t.nonNull.float('balance');
        t.nonNull.float('heldBalance');
        t.nonNull.float('totalFunds', {
            resolve: (parent) => parent.balance + parent.heldBalance,
        });
        t.nonNull.float('paymentEscrowBalance', {
            resolve: async (parent, _, ctx) => {
                const result = await ctx.prisma.walletLedgerEntry.aggregate({
                    where: {
                        walletId: parent.id,
                        deletedAt: null,
                        sourceType: 'ESCROW_HOLD',
                        type: 'CREDIT',
                        status: 'HELD',
                        environment: parent.environment,
                    },
                    _sum: { amount: true },
                });
                return result._sum.amount ?? 0;
            },
        });
        t.nonNull.int('paymentEscrowOrderCount', {
            resolve: (parent, _, ctx) => ctx.prisma.walletLedgerEntry.count({
                where: {
                    walletId: parent.id,
                    deletedAt: null,
                    sourceType: 'ESCROW_HOLD',
                    type: 'CREDIT',
                    status: 'HELD',
                    environment: parent.environment,
                },
            }),
        });
        t.nonNull.float('pendingWithdrawalTotal', {
            resolve: async (parent, _, ctx) => {
                const result = await ctx.prisma.withdrawal.aggregate({
                    where: {
                        walletId: parent.id,
                        deletedAt: null,
                        status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
                    },
                    _sum: { amount: true },
                });
                return result._sum.amount ?? 0;
            },
        });
        t.nonNull.float('totalWithdrawn', {
            resolve: async (parent, _, ctx) => {
                const result = await ctx.prisma.withdrawal.aggregate({
                    where: { walletId: parent.id, deletedAt: null, status: 'COMPLETED' },
                    _sum: { amount: true },
                });
                return result._sum.amount ?? 0;
            },
        });
        t.nonNull.float('lifetimeEarnings', {
            resolve: async (parent, _, ctx) => {
                const result = await ctx.prisma.walletLedgerEntry.aggregate({
                    where: {
                        walletId: parent.id,
                        deletedAt: null,
                        sourceType: 'PURCHASE_ORDER_SETTLEMENT',
                        type: 'CREDIT',
                    },
                    _sum: { amount: true },
                });
                return result._sum.amount ?? 0;
            },
        });
        t.nonNull.float('feesPaid', {
            resolve: async (parent, _, ctx) => {
                const result = await ctx.prisma.walletLedgerEntry.aggregate({
                    where: {
                        walletId: parent.id,
                        deletedAt: null,
                        sourceType: { in: ['PLATFORM_FEE', 'SUBSCRIPTION_FEE'] },
                        type: 'DEBIT',
                    },
                    _sum: { amount: true },
                });
                return Math.abs(result._sum.amount ?? 0);
            },
        });
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
