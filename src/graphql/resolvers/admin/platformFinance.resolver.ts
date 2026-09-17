import { arg, extendType, floatArg, intArg, nonNull, nullable, objectType, stringArg } from 'nexus';

import { requireAdminPermission } from '../../../lib/adminGovernance.js';
import {
  approvePlatformWithdrawal,
  completeSandboxPlatformWithdrawal,
  createPlatformPayoutMethod,
  failSandboxPlatformWithdrawal,
  rejectPlatformWithdrawal,
  requestPlatformWithdrawal,
  startPlatformWithdrawalPayout,
  verifyPlatformPayoutMethod,
} from '../../../services/platformWithdrawal.service.js';
import { getOrCreatePlatformWallet } from '../../../services/platformWallet.service.js';

const DEFAULT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
const PAGE_SIZES = [20, 50, 100];

const actor = (ctx: any) => {
  const value = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
  if (!Number.isInteger(value.id) || value.id < 1) throw new Error('Authenticated platform administrator identity is required.');
  return value;
};
const page = (value?: number | null, size?: number | null) => {
  const current = value ?? 1; const pageSize = size ?? 20;
  if (!Number.isInteger(current) || current < 1 || !PAGE_SIZES.includes(pageSize)) throw new Error('Invalid pagination.');
  return { current, pageSize };
};
const reason = (value: string) => {
  const normalized = value.trim();
  if (normalized.length < 5 || normalized.length > 500) throw new Error('Reason must be between 5 and 500 characters.');
  return normalized;
};

export const PlatformPayoutMethod = objectType({
  name: 'PlatformPayoutMethod',
  definition(t) {
    t.nonNull.string('id'); t.nonNull.field('environment', { type: 'Environment' }); t.nonNull.field('type', { type: 'PayoutMethodType' });
    t.nonNull.string('accountName'); t.nonNull.string('maskedAccountNumber'); t.nullable.string('bankName');
    t.nonNull.boolean('isVerified'); t.nonNull.boolean('isActive'); t.nullable.dateTime('verifiedAt'); t.nonNull.dateTime('createdAt');
  },
});

export const PlatformWithdrawalPayoutAttempt = objectType({
  name: 'PlatformWithdrawalPayoutAttempt',
  definition(t) {
    t.nonNull.string('id'); t.nonNull.string('provider'); t.nonNull.string('status'); t.nullable.string('providerReference');
    t.nullable.string('failureReason'); t.nonNull.dateTime('createdAt'); t.nullable.dateTime('completedAt');
  },
});

export const PlatformWithdrawal = objectType({
  name: 'PlatformWithdrawal',
  definition(t) {
    t.nonNull.string('id'); t.nonNull.float('amount'); t.nonNull.string('status'); t.nonNull.field('environment', { type: 'Environment' });
    t.nonNull.int('requestedById'); t.nullable.int('approvedById'); t.nonNull.dateTime('requestedAt'); t.nullable.dateTime('approvedAt'); t.nullable.dateTime('completedAt');
    t.nullable.string('rejectionReason'); t.nonNull.string('payoutDestinationMasked'); t.nonNull.string('payoutDestinationAccount'); t.nullable.string('payoutDestinationBank');
    t.nonNull.field('payoutMethodTypeSnapshot', { type: 'PayoutMethodType' });
    t.nonNull.list.nonNull.field('payoutAttempts', { type: 'PlatformWithdrawalPayoutAttempt' });
  },
});

export const PlatformWithdrawalPage = objectType({
  name: 'PlatformWithdrawalPage',
  definition(t) { t.nonNull.list.nonNull.field('items', { type: 'PlatformWithdrawal' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('pageSize'); },
});

export const PlatformFeeSummary = objectType({
  name: 'PlatformFeeSummary',
  definition(t) {
    t.nonNull.field('wallet', { type: 'PlatformWallet' }); t.nonNull.float('totalEarned'); t.nonNull.float('totalWithdrawn');
    t.nonNull.float('pendingAmount'); t.nonNull.int('pendingCount'); t.nonNull.int('processingCount');
  },
});

export const PlatformFeeLedgerRow = objectType({
  name: 'PlatformFeeLedgerRow',
  definition(t) {
    t.nonNull.string('id'); t.nonNull.string('sourceType'); t.nonNull.string('referenceId'); t.nonNull.float('amount'); t.nonNull.float('balanceAfter');
    t.nonNull.field('environment', { type: 'Environment' }); t.nonNull.dateTime('createdAt'); t.nullable.string('purchaseOrderId'); t.nullable.string('paymentTransactionId');
    t.nullable.float('grossAmount'); t.nullable.float('platformFee'); t.nullable.float('supplierNet'); t.nonNull.string('channel');
  },
});

export const PlatformFeeLedgerPage = objectType({
  name: 'PlatformFeeLedgerPage',
  definition(t) { t.nonNull.list.nonNull.field('items', { type: 'PlatformFeeLedgerRow' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('pageSize'); },
});

export const PlatformFinanceQueries = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.field('platformFeeSummary', {
      type: 'PlatformFeeSummary', args: { environment: nullable(arg({ type: 'Environment' })) },
      async resolve(_r, args, ctx) {
        requireAdminPermission(ctx, 'PLATFORM_WALLET_VIEW');
        const environment = args.environment ?? DEFAULT_ENVIRONMENT;
        const wallet = await getOrCreatePlatformWallet(ctx.prisma, environment);
        const [earned, withdrawn, pending] = await Promise.all([
          ctx.prisma.platformWalletLedgerEntry.aggregate({ where: { walletId: wallet.id, environment, sourceType: { in: ['TRANSACTION_FEE', 'PURCHASE_ORDER_PLATFORM_FEE'] }, type: 'CREDIT' }, _sum: { amount: true } }),
          ctx.prisma.platformWithdrawal.aggregate({ where: { walletId: wallet.id, environment, status: 'COMPLETED', deletedAt: null }, _sum: { amount: true } }),
          ctx.prisma.platformWithdrawal.groupBy({ by: ['status'], where: { walletId: wallet.id, environment, status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] }, deletedAt: null }, _sum: { amount: true }, _count: { _all: true } }),
        ]);
        const status = (name: string) => pending.find((row: any) => row.status === name);
        return { wallet, totalEarned: earned._sum.amount ?? 0, totalWithdrawn: withdrawn._sum.amount ?? 0, pendingAmount: pending.reduce((sum: number, row: any) => sum + (row._sum.amount ?? 0), 0), pendingCount: (status('PENDING')?._count._all ?? 0) + (status('APPROVED')?._count._all ?? 0), processingCount: status('PROCESSING')?._count._all ?? 0 };
      },
    });
    t.nonNull.list.nonNull.field('platformPayoutMethods', {
      type: 'PlatformPayoutMethod', args: { environment: nullable(arg({ type: 'Environment' })) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'PLATFORM_WALLET_VIEW'); return ctx.prisma.platformPayoutMethod.findMany({ where: { environment: args.environment ?? DEFAULT_ENVIRONMENT, deletedAt: null }, orderBy: { createdAt: 'desc' } }); },
    });
    t.nonNull.field('platformFeeLedger', {
      type: 'PlatformFeeLedgerPage',
      args: { environment: nullable(arg({ type: 'Environment' })), page: nullable(intArg()), pageSize: nullable(intArg()) },
      async resolve(_r, args, ctx) {
        requireAdminPermission(ctx, 'PLATFORM_LEDGER_VIEW'); const pagination = page(args.page, args.pageSize); const environment = args.environment ?? DEFAULT_ENVIRONMENT;
        const wallet = await getOrCreatePlatformWallet(ctx.prisma, environment);
        const where = { walletId: wallet.id, environment, sourceType: { in: ['PURCHASE_ORDER_PLATFORM_FEE', 'TRANSACTION_FEE'] } };
        const [entries, total] = await Promise.all([
          ctx.prisma.platformWalletLedgerEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pagination.current - 1) * pagination.pageSize, take: pagination.pageSize }),
          ctx.prisma.platformWalletLedgerEntry.count({ where }),
        ]);
        const settlementIds = entries.filter((entry: any) => entry.sourceType === 'PURCHASE_ORDER_PLATFORM_FEE').map((entry: any) => entry.referenceId).filter(Boolean);
        const paymentIds = entries.map((entry: any) => entry.paymentTransactionId ?? (entry.sourceType === 'TRANSACTION_FEE' ? entry.referenceId : null)).filter(Boolean);
        const [settlements, payments] = await Promise.all([
          ctx.prisma.purchaseOrderSettlement.findMany({ where: { OR: [{ id: { in: settlementIds } }, { paymentTransactionId: { in: paymentIds } }] } }),
          ctx.prisma.paymentTransaction.findMany({ where: { id: { in: paymentIds } }, select: { id: true, payerAgentId: true, feeSnapshot: true } }),
        ]);
        const bySettlement: Map<string, any> = new Map(settlements.map((item: any) => [item.id, item])); const byPayment: Map<string, any> = new Map(settlements.map((item: any) => [item.paymentTransactionId, item])); const paymentById: Map<string, any> = new Map(payments.map((item: any) => [item.id, item]));
        return { items: entries.map((entry: any) => { const settlement = entry.sourceType === 'PURCHASE_ORDER_PLATFORM_FEE' ? bySettlement.get(entry.referenceId) : byPayment.get(entry.paymentTransactionId ?? entry.referenceId); const payment = paymentById.get(entry.paymentTransactionId ?? settlement?.paymentTransactionId ?? entry.referenceId); return { ...entry, referenceId: entry.referenceId ?? '', purchaseOrderId: settlement?.purchaseOrderId ?? null, grossAmount: settlement?.grossAmount ?? null, platformFee: settlement?.platformFee ?? entry.amount, supplierNet: settlement?.supplierNet ?? null, channel: payment?.feeSnapshot?.checkoutApplication ?? (payment?.payerAgentId ? 'KOMPRA_PH' : 'KOMPRA_PORTAL') }; }), total, page: pagination.current, pageSize: pagination.pageSize };
      },
    });
    t.nonNull.field('platformWithdrawals', {
      type: 'PlatformWithdrawalPage',
      args: { environment: nullable(arg({ type: 'Environment' })), status: nullable(arg({ type: 'WithdrawalStatus' })), page: nullable(intArg()), pageSize: nullable(intArg()) },
      async resolve(_r, args, ctx) {
        requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_VIEW'); const pagination = page(args.page, args.pageSize);
        const where = { environment: args.environment ?? DEFAULT_ENVIRONMENT, deletedAt: null, ...(args.status ? { status: args.status } : {}) };
        const [items, total] = await Promise.all([
          ctx.prisma.platformWithdrawal.findMany({ where, include: { payoutAttempts: { orderBy: { createdAt: 'desc' } } }, orderBy: { requestedAt: 'desc' }, skip: (pagination.current - 1) * pagination.pageSize, take: pagination.pageSize }),
          ctx.prisma.platformWithdrawal.count({ where }),
        ]);
        return { items, total, page: pagination.current, pageSize: pagination.pageSize };
      },
    });
  },
});

export const PlatformFinanceMutations = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('createPlatformPayoutMethod', {
      type: 'PlatformPayoutMethod',
      args: { environment: nonNull(arg({ type: 'Environment' })), type: nonNull(arg({ type: 'PayoutMethodType' })), accountName: nonNull(stringArg()), destination: nonNull(stringArg()), bankName: nullable(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => createPlatformPayoutMethod(tx, args as any, actor(ctx))); },
    });
    t.nonNull.field('requestPlatformWithdrawal', {
      type: 'PlatformWithdrawal', args: { environment: nonNull(arg({ type: 'Environment' })), amount: nonNull(floatArg()), payoutMethodId: nonNull(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => requestPlatformWithdrawal(tx, args.environment as any, args.amount, args.payoutMethodId, actor(ctx)), { isolationLevel: 'Serializable' }); },
    });
    t.nonNull.field('verifyPlatformPayoutMethod', {
      type: 'PlatformPayoutMethod', args: { id: nonNull(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => verifyPlatformPayoutMethod(tx, args.id, actor(ctx))); },
    });
    t.nonNull.field('approvePlatformWithdrawal', {
      type: 'PlatformWithdrawal', args: { id: nonNull(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => approvePlatformWithdrawal(tx, args.id, actor(ctx)), { isolationLevel: 'Serializable' }); },
    });
    t.nonNull.field('rejectPlatformWithdrawal', {
      type: 'PlatformWithdrawal', args: { id: nonNull(stringArg()), reason: nonNull(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => rejectPlatformWithdrawal(tx, args.id, reason(args.reason), actor(ctx)), { isolationLevel: 'Serializable' }); },
    });
    t.nonNull.field('processPlatformWithdrawalPayout', {
      type: 'PlatformWithdrawal', args: { id: nonNull(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => startPlatformWithdrawalPayout(tx, args.id, actor(ctx)), { isolationLevel: 'Serializable' }); },
    });
    t.nonNull.field('completeSandboxPlatformWithdrawal', {
      type: 'PlatformWithdrawal', args: { id: nonNull(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => completeSandboxPlatformWithdrawal(tx, args.id, actor(ctx)), { isolationLevel: 'Serializable' }); },
    });
    t.nonNull.field('failSandboxPlatformWithdrawal', {
      type: 'PlatformWithdrawal', args: { id: nonNull(stringArg()), reason: nonNull(stringArg()) },
      resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE'); return ctx.prisma.$transaction((tx: any) => failSandboxPlatformWithdrawal(tx, args.id, reason(args.reason), actor(ctx)), { isolationLevel: 'Serializable' }); },
    });
  },
});
