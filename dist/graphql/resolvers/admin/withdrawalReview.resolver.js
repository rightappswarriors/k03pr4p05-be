import { arg, extendType, intArg, nonNull, nullable, objectType, stringArg } from 'nexus';
import { requireAdminPermission } from '../../../lib/adminGovernance.js';
import { sendToOrg } from '../../../lib/ws.js';
import { approveWithdrawalReview, rejectWithdrawalReview } from '../../../services/adminWithdrawalReview.service.js';
import { completeSandboxWithdrawalPayout, failSandboxWithdrawalPayout, startWithdrawalPayout } from '../../../services/withdrawalPayout.service.js';
const DEFAULT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
const PAGE_SIZES = [30, 50, 100, 200];
const MAX_SEARCH_LENGTH = 100;
export const AdminWithdrawalReviewRow = objectType({
    name: 'AdminWithdrawalReviewRow',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('reference');
        t.nonNull.float('amount');
        t.nonNull.field('status', { type: 'WithdrawalStatus' });
        t.nonNull.field('environment', { type: 'Environment' });
        t.nonNull.dateTime('requestedAt');
        t.nullable.dateTime('approvedAt');
        t.nullable.string('rejectionReason');
        t.nonNull.int('supplierOrgId');
        t.nonNull.string('supplierName');
        t.nullable.string('requestedByName');
        t.nullable.string('approvedByName');
        t.nonNull.field('payoutMethodType', { type: 'PayoutMethodType' });
        t.nullable.string('bankName');
        t.nonNull.string('accountName');
        t.nonNull.string('maskedAccountNumber');
        t.nonNull.boolean('payoutMethodVerified');
        t.nonNull.float('walletBalance');
        t.nonNull.float('walletHeldBalance');
    },
});
export const AdminWithdrawalReviewPage = objectType({
    name: 'AdminWithdrawalReviewPage',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'AdminWithdrawalReviewRow' });
        t.nonNull.int('total');
        t.nonNull.int('page');
        t.nonNull.int('pageSize');
    },
});
export const AdminWithdrawalReviewSummary = objectType({
    name: 'AdminWithdrawalReviewSummary',
    definition(t) {
        t.nonNull.int('pendingCount');
        t.nonNull.float('pendingAmount');
        t.nonNull.int('approvedCount');
        t.nonNull.int('processingCount');
        t.nonNull.int('rejectedCount');
        t.nonNull.int('completedCount');
        t.nonNull.int('failedCount');
        t.nonNull.float('completedAmount');
    },
});
const ensureDateRange = (from, to) => {
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        throw new Error('Date filters must be valid dates.');
    }
    if (from && to && from > to)
        throw new Error('Start date cannot be after end date.');
};
const normalizePage = (page, pageSize) => {
    const normalizedPage = page ?? 1;
    const normalizedPageSize = pageSize ?? 30;
    if (!Number.isInteger(normalizedPage) || normalizedPage < 1)
        throw new Error('Page must be at least 1.');
    if (!PAGE_SIZES.includes(normalizedPageSize))
        throw new Error(`Page size must be one of: ${PAGE_SIZES.join(', ')}.`);
    return { page: normalizedPage, pageSize: normalizedPageSize };
};
const mapRows = async (ctx, rows) => {
    const userIds = [...new Set(rows.flatMap((row) => [row.requestedById, row.approvedById].filter(Boolean)))];
    const users = userIds.length
        ? await ctx.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullname: true } })
        : [];
    const userNames = new Map(users.map((user) => [user.id, user.fullname]));
    return rows.map((row) => ({
        id: row.id,
        reference: `WD-${String(row.id).padStart(6, '0')}`,
        amount: row.amount,
        status: row.status,
        environment: row.environment,
        requestedAt: row.requestedAt,
        approvedAt: row.approvedAt,
        rejectionReason: row.rejectionReason,
        supplierOrgId: row.wallet.orgId,
        supplierName: row.wallet.organization.name,
        requestedByName: userNames.get(row.requestedById) ?? null,
        approvedByName: row.approvedById ? userNames.get(row.approvedById) ?? null : null,
        payoutMethodType: row.payoutMethod.type,
        bankName: row.payoutMethod.bankName,
        accountName: row.payoutMethod.accountName,
        maskedAccountNumber: row.payoutMethod.maskedAccountNumber,
        payoutMethodVerified: row.payoutMethod.isVerified,
        walletBalance: row.wallet.balance,
        walletHeldBalance: row.wallet.heldBalance,
    }));
};
const listWhere = async (ctx, args) => {
    const environment = args.environment ?? DEFAULT_ENVIRONMENT;
    const where = { deletedAt: null, environment };
    if (args.status)
        where.status = args.status;
    if (args.supplierOrgId != null) {
        if (!Number.isInteger(args.supplierOrgId) || args.supplierOrgId < 1)
            throw new Error('Supplier must be a valid organization.');
        where.wallet = { orgId: args.supplierOrgId };
    }
    ensureDateRange(args.from, args.to);
    if (args.from || args.to)
        where.requestedAt = { ...(args.from ? { gte: args.from } : {}), ...(args.to ? { lte: args.to } : {}) };
    const search = args.search?.trim() ?? '';
    if (args.search != null && search.length > MAX_SEARCH_LENGTH)
        throw new Error(`Search must not exceed ${MAX_SEARCH_LENGTH} characters.`);
    if (search) {
        const referenceId = /^WD-(\d+)$/i.test(search) ? Number(search.slice(3)) : Number.NaN;
        where.OR = [
            ...(Number.isSafeInteger(referenceId) ? [{ id: referenceId }] : []),
            { wallet: { organization: { name: { contains: search, mode: 'insensitive' } } } },
            { payoutMethod: { bankName: { contains: search, mode: 'insensitive' } } },
            { payoutMethod: { maskedAccountNumber: { contains: search, mode: 'insensitive' } } },
        ];
    }
    return where;
};
export const AdminWithdrawalReviewQueries = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.field('adminWithdrawals', {
            type: 'AdminWithdrawalReviewPage',
            args: {
                environment: nullable(arg({ type: 'Environment' })),
                status: nullable(arg({ type: 'WithdrawalStatus' })),
                supplierOrgId: nullable(intArg()),
                search: nullable(stringArg()),
                from: nullable(arg({ type: 'DateTime' })),
                to: nullable(arg({ type: 'DateTime' })),
                page: nullable(intArg()),
                pageSize: nullable(intArg()),
            },
            async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_VIEW');
                const { page, pageSize } = normalizePage(args.page, args.pageSize);
                const where = await listWhere(ctx, args);
                const [rows, total] = await Promise.all([
                    ctx.prisma.withdrawal.findMany({
                        where,
                        include: { wallet: { include: { organization: { select: { name: true } } } }, payoutMethod: true },
                        orderBy: { requestedAt: 'desc' },
                        skip: (page - 1) * pageSize,
                        take: pageSize,
                    }),
                    ctx.prisma.withdrawal.count({ where }),
                ]);
                return { items: await mapRows(ctx, rows), total, page, pageSize };
            },
        });
        t.nonNull.field('adminWithdrawalSummary', {
            type: 'AdminWithdrawalReviewSummary',
            args: { environment: nullable(arg({ type: 'Environment' })) },
            async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_VIEW');
                const groups = await ctx.prisma.withdrawal.groupBy({
                    by: ['status'],
                    where: { deletedAt: null, environment: args.environment ?? DEFAULT_ENVIRONMENT },
                    _count: { _all: true },
                    _sum: { amount: true },
                });
                const value = (status) => groups.find((group) => group.status === status);
                return {
                    pendingCount: value('PENDING')?._count._all ?? 0,
                    pendingAmount: value('PENDING')?._sum.amount ?? 0,
                    approvedCount: value('APPROVED')?._count._all ?? 0,
                    processingCount: value('PROCESSING')?._count._all ?? 0,
                    rejectedCount: value('REJECTED')?._count._all ?? 0,
                    completedCount: value('COMPLETED')?._count._all ?? 0,
                    failedCount: value('FAILED')?._count._all ?? 0,
                    completedAmount: value('COMPLETED')?._sum.amount ?? 0,
                };
            },
        });
    },
});
const validWithdrawalId = (withdrawalId) => {
    if (!Number.isInteger(withdrawalId) || withdrawalId < 1)
        throw new Error('Withdrawal ID must be a positive integer.');
};
export const AdminWithdrawalReviewMutations = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('approveWithdrawal', {
            type: 'Withdrawal',
            args: { withdrawalId: nonNull(intArg()) },
            async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                validWithdrawalId(args.withdrawalId);
                const actor = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
                if (!Number.isInteger(actor.id) || actor.id < 1)
                    throw new Error('Authenticated administrator identity is required.');
                const result = await ctx.prisma.$transaction((tx) => approveWithdrawalReview(tx, args.withdrawalId, actor), { isolationLevel: 'Serializable' });
                sendToOrg(result.supplierOrgId, 'withdrawal:updated', { withdrawalId: result.withdrawal.id, status: result.withdrawal.status });
                sendToOrg(result.supplierOrgId, 'wallet:updated', { walletId: result.wallet.id });
                return result.withdrawal;
            },
        });
        t.nonNull.field('rejectWithdrawal', {
            type: 'Withdrawal',
            args: { withdrawalId: nonNull(intArg()), reason: nonNull(stringArg()) },
            async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                validWithdrawalId(args.withdrawalId);
                const reason = args.reason.trim();
                if (!reason)
                    throw new Error('Please provide a reason for rejection.');
                if (reason.length < 5)
                    throw new Error('Reason must be at least 5 characters.');
                if (reason.length > 500)
                    throw new Error('Reason must not exceed 500 characters.');
                const actor = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
                if (!Number.isInteger(actor.id) || actor.id < 1)
                    throw new Error('Authenticated administrator identity is required.');
                const result = await ctx.prisma.$transaction((tx) => rejectWithdrawalReview(tx, args.withdrawalId, reason, actor), { isolationLevel: 'Serializable' });
                sendToOrg(result.supplierOrgId, 'withdrawal:updated', { withdrawalId: result.withdrawal.id, status: result.withdrawal.status });
                sendToOrg(result.supplierOrgId, 'wallet:updated', { walletId: result.wallet.id });
                return result.withdrawal;
            },
        });
        t.nonNull.field('processWithdrawalPayout', {
            type: 'Withdrawal',
            args: { withdrawalId: nonNull(intArg()) },
            async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                validWithdrawalId(args.withdrawalId);
                const actor = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
                if (!Number.isInteger(actor.id) || actor.id < 1)
                    throw new Error('Authenticated administrator identity is required.');
                const result = await ctx.prisma.$transaction((tx) => startWithdrawalPayout(tx, args.withdrawalId, actor), { isolationLevel: 'Serializable' });
                sendToOrg(result.supplierOrgId, 'withdrawal:updated', { withdrawalId: result.withdrawal.id, status: result.withdrawal.status });
                sendToOrg(result.supplierOrgId, 'wallet:updated', { walletId: result.walletId });
                return result.withdrawal;
            },
        });
        t.nonNull.field('completeSandboxWithdrawalPayout', {
            type: 'Withdrawal',
            args: { withdrawalId: nonNull(intArg()) },
            async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                validWithdrawalId(args.withdrawalId);
                const actor = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
                if (!Number.isInteger(actor.id) || actor.id < 1)
                    throw new Error('Authenticated administrator identity is required.');
                const result = await ctx.prisma.$transaction((tx) => completeSandboxWithdrawalPayout(tx, args.withdrawalId, actor), { isolationLevel: 'Serializable' });
                sendToOrg(result.supplierOrgId, 'withdrawal:updated', { withdrawalId: result.withdrawal.id, status: result.withdrawal.status });
                sendToOrg(result.supplierOrgId, 'wallet:updated', { walletId: result.walletId });
                return result.withdrawal;
            },
        });
        t.nonNull.field('failSandboxWithdrawalPayout', {
            type: 'Withdrawal',
            args: { withdrawalId: nonNull(intArg()), reason: nonNull(stringArg()) },
            async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                validWithdrawalId(args.withdrawalId);
                const reason = args.reason.trim();
                if (reason.length < 5 || reason.length > 500)
                    throw new Error('Failure reason must be between 5 and 500 characters.');
                const actor = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
                if (!Number.isInteger(actor.id) || actor.id < 1)
                    throw new Error('Authenticated administrator identity is required.');
                const result = await ctx.prisma.$transaction((tx) => failSandboxWithdrawalPayout(tx, args.withdrawalId, reason, actor), { isolationLevel: 'Serializable' });
                sendToOrg(result.supplierOrgId, 'withdrawal:updated', { withdrawalId: result.withdrawal.id, status: result.withdrawal.status });
                sendToOrg(result.supplierOrgId, 'wallet:updated', { walletId: result.walletId });
                return result.withdrawal;
            },
        });
    },
});
