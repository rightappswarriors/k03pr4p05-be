import { arg, booleanArg, extendType, intArg, nonNull, nullable, objectType, stringArg } from 'nexus';
import { requireAdminPermission } from '../../../lib/adminGovernance.js';
import { getProductionPayoutProvider } from '../../../services/productionPayoutProvider.service.js';
const PAGE_SIZES = [30, 50, 100, 200];
const MAX_SEARCH_LENGTH = 100;
const STALE_MS = Number(process.env.PAYOUT_PROCESSING_STALE_MS ?? 60 * 60 * 1000);
const ATTEMPT_STATUSES = ['PROCESSING', 'SUCCEEDED', 'FAILED', 'RECONCILIATION_REQUIRED'];
const WITHDRAWAL_STATUSES = ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'];
const DIAGNOSTICS = ['LEGACY_NO_PAYOUT_ATTEMPT', 'STATUS_INCONSISTENCY', 'ATTEMPT_AMOUNT_MISMATCH', 'ENVIRONMENT_MISMATCH', 'RESERVATION_MISSING', 'RESERVATION_AMOUNT_MISMATCH', 'HELD_BALANCE_INSUFFICIENT', 'PAYOUT_LEDGER_MISSING', 'STALE_PROCESSING', 'PROVIDER_REFERENCE_MISSING'];
export const PayoutReconciliationRow = objectType({
    name: 'PayoutReconciliationRow',
    definition(t) {
        t.nonNull.int('withdrawalId');
        t.nonNull.string('withdrawalReference');
        t.nonNull.string('supplierName');
        t.nonNull.float('amount');
        t.nonNull.field('environment', { type: 'Environment' });
        t.nonNull.field('withdrawalStatus', { type: 'WithdrawalStatus' });
        t.nullable.string('attemptId');
        t.nullable.string('provider');
        t.nullable.string('providerReference');
        t.nullable.string('attemptStatus');
        t.nullable.dateTime('attemptUpdatedAt');
        t.nonNull.list.nonNull.string('warnings');
        t.nonNull.dateTime('requestedAt');
        t.nullable.dateTime('approvedAt');
        t.nullable.dateTime('completedAt');
        t.nullable.string('payoutDestinationBank');
        t.nullable.string('payoutDestinationMasked');
        t.nullable.string('payoutMethodTypeSnapshot');
        t.nullable.string('reservationStatus');
        t.nullable.float('reservationAmount');
        t.nullable.string('terminalLedgerStatus');
        t.nullable.float('terminalLedgerAmount');
        t.nonNull.float('walletBalance');
        t.nonNull.float('walletHeldBalance');
        t.nonNull.boolean('legacyReviewed');
        t.nullable.dateTime('legacyReviewedAt');
        t.nullable.int('legacyReviewedById');
    },
});
export const PayoutReconciliationPage = objectType({ name: 'PayoutReconciliationPage', definition(t) { t.nonNull.list.nonNull.field('items', { type: 'PayoutReconciliationRow' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('pageSize'); } });
export const PayoutReconciliationSummary = objectType({ name: 'PayoutReconciliationSummary', definition(t) { t.nonNull.int('reconciliationRequired'); t.nonNull.int('processing'); t.nonNull.int('failed'); t.nonNull.int('succeeded'); t.nonNull.int('needsReview'); } });
const validPage = (page, pageSize) => {
    const normalizedPage = page ?? 1;
    const normalizedPageSize = pageSize ?? 30;
    if (!Number.isInteger(normalizedPage) || normalizedPage < 1)
        throw new Error('Page must be at least 1.');
    if (!PAGE_SIZES.includes(normalizedPageSize))
        throw new Error(`Page size must be one of: ${PAGE_SIZES.join(', ')}.`);
    return { page: normalizedPage, pageSize: normalizedPageSize };
};
const optionalEnum = (value, allowed, label) => {
    if (value == null)
        return undefined;
    if (!allowed.includes(value))
        throw new Error(`${label} is invalid.`);
    return value;
};
const optionalDate = (value, label) => {
    if (value == null)
        return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        throw new Error(`${label} must be a valid ISO date.`);
    return date;
};
const diagnostics = (withdrawal, attempt) => {
    const warnings = [];
    const reservation = withdrawal.wallet.ledgerEntries.find((entry) => entry.referenceId === `withdrawal:${withdrawal.id}` && entry.status === 'HELD');
    const terminalLedger = withdrawal.wallet.ledgerEntries.find((entry) => entry.referenceId === `withdrawal-payout:${withdrawal.id}` || entry.referenceId === `withdrawal-payout-failure:${withdrawal.id}`);
    if (!attempt && withdrawal.environment === 'SANDBOX' && withdrawal.status === 'COMPLETED' && terminalLedger)
        warnings.push('LEGACY_NO_PAYOUT_ATTEMPT');
    if (['PENDING', 'APPROVED', 'PROCESSING'].includes(withdrawal.status) && !reservation)
        warnings.push('RESERVATION_MISSING');
    if (reservation && Math.abs(reservation.amount) !== withdrawal.amount)
        warnings.push('RESERVATION_AMOUNT_MISMATCH');
    if (['PENDING', 'APPROVED', 'PROCESSING'].includes(withdrawal.status) && withdrawal.wallet.heldBalance < withdrawal.amount)
        warnings.push('HELD_BALANCE_INSUFFICIENT');
    if (withdrawal.status === 'PROCESSING' && !attempt)
        warnings.push('STATUS_INCONSISTENCY');
    if (withdrawal.status === 'COMPLETED' && !terminalLedger)
        warnings.push('PAYOUT_LEDGER_MISSING');
    if (withdrawal.status === 'COMPLETED' && attempt && attempt.status !== 'SUCCEEDED')
        warnings.push('STATUS_INCONSISTENCY');
    if (withdrawal.status === 'FAILED' && attempt?.status === 'SUCCEEDED')
        warnings.push('STATUS_INCONSISTENCY');
    if (attempt && attempt.amount !== withdrawal.amount)
        warnings.push('ATTEMPT_AMOUNT_MISMATCH');
    if (attempt && attempt.environment !== withdrawal.environment)
        warnings.push('ENVIRONMENT_MISMATCH');
    if (attempt && !attempt.providerReference)
        warnings.push('PROVIDER_REFERENCE_MISSING');
    if (attempt?.status === 'PROCESSING' && Date.now() - new Date(attempt.updatedAt).getTime() > STALE_MS)
        warnings.push('STALE_PROCESSING');
    return warnings;
};
const recordAudit = (ctx, action, withdrawal, attempt, extra = {}) => ctx.prisma.auditLog.create({ data: { orgId: Number(ctx.user?.orgId ?? 0), userId: Number(ctx.user?.id ?? ctx.user?.userId ?? 0), pageKey: 'payoutReconciliation', action: 'STATUS_CHANGE', recordType: 'WithdrawalPayoutAttempt', recordId: attempt.id, newValue: { action, withdrawalId: withdrawal.id, providerReference: attempt.providerReference, environment: attempt.environment, ...extra } } });
export const PayoutReconciliationQueries = extendType({
    type: 'Query', definition(t) {
        t.nonNull.list.nonNull.string('adminPayoutReconciliationProviders', { args: { environment: nonNull(arg({ type: 'Environment' })) }, async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_VIEW');
                const providers = await ctx.prisma.withdrawalPayoutAttempt.findMany({ where: { environment: args.environment, provider: { not: '' } }, distinct: ['provider'], select: { provider: true }, orderBy: { provider: 'asc' } });
                return providers.map((row) => row.provider);
            } });
        t.nonNull.field('adminPayoutReconciliations', { type: 'PayoutReconciliationPage', args: { environment: nonNull(arg({ type: 'Environment' })), search: nullable(stringArg()), attemptStatus: nullable(stringArg()), withdrawalStatus: nullable(stringArg()), diagnostic: nullable(stringArg()), needsReview: nullable(booleanArg()), provider: nullable(stringArg()), startDate: nullable(stringArg()), endDate: nullable(stringArg()), page: nullable(intArg()), pageSize: nullable(intArg()) }, async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_VIEW');
                const { page, pageSize } = validPage(args.page, args.pageSize);
                const search = args.search?.trim() ?? '';
                if (search.length > MAX_SEARCH_LENGTH)
                    throw new Error(`Search must not exceed ${MAX_SEARCH_LENGTH} characters.`);
                const attemptStatus = optionalEnum(args.attemptStatus, ATTEMPT_STATUSES, 'Attempt status');
                const withdrawalStatus = optionalEnum(args.withdrawalStatus, WITHDRAWAL_STATUSES, 'Withdrawal status');
                const diagnostic = optionalEnum(args.diagnostic, DIAGNOSTICS, 'Diagnostic');
                const provider = args.provider?.trim();
                const startDate = optionalDate(args.startDate, 'Start date');
                const endDate = optionalDate(args.endDate, 'End date');
                if (provider && provider.length > 100)
                    throw new Error('Provider is invalid.');
                if (startDate && endDate && startDate > endDate)
                    throw new Error('Start date must be on or before end date.');
                const attemptWhere = {};
                if (attemptStatus)
                    attemptWhere.status = attemptStatus;
                if (provider)
                    attemptWhere.provider = provider;
                if (startDate || endDate)
                    attemptWhere.updatedAt = { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) };
                const where = { deletedAt: null, environment: args.environment };
                if (withdrawalStatus)
                    where.status = withdrawalStatus;
                if (attemptStatus || provider || startDate || endDate)
                    where.payoutAttempts = { some: attemptWhere };
                if (search)
                    where.AND = [{ OR: [{ wallet: { organization: { name: { contains: search, mode: 'insensitive' } } } }, { payoutAttempts: { some: { providerReference: { contains: search, mode: 'insensitive' } } } }, ...(/^WD-(\d+)$/i.test(search) ? [{ id: Number(search.slice(3)) }] : [])] }];
                const withdrawals = await ctx.prisma.withdrawal.findMany({ where, include: { wallet: { include: { organization: { select: { name: true } }, ledgerEntries: { where: { sourceType: 'WITHDRAWAL', deletedAt: null } } } }, payoutAttempts: { where: Object.keys(attemptWhere).length ? attemptWhere : undefined, orderBy: { updatedAt: 'desc' }, take: 1 } }, orderBy: { requestedAt: 'desc' } });
                const auditRows = await ctx.prisma.auditLog.findMany({ where: { pageKey: 'payoutReconciliation', recordType: 'Withdrawal', deletedAt: null }, orderBy: { createdAt: 'desc' } });
                const acknowledged = new Map();
                for (const auditRow of auditRows)
                    if (auditRow.newValue?.action === 'LEGACY_PAYOUT_RECONCILIATION_ACKNOWLEDGED' && auditRow.recordId && !acknowledged.has(auditRow.recordId))
                        acknowledged.set(auditRow.recordId, auditRow);
                const rows = withdrawals.map((withdrawal) => { const attempt = withdrawal.payoutAttempts[0]; const reservation = withdrawal.wallet.ledgerEntries.find((entry) => entry.referenceId === `withdrawal:${withdrawal.id}`); const terminalLedger = withdrawal.wallet.ledgerEntries.find((entry) => entry.referenceId === `withdrawal-payout:${withdrawal.id}` || entry.referenceId === `withdrawal-payout-failure:${withdrawal.id}`); const legacyReview = acknowledged.get(String(withdrawal.id)); return { withdrawalId: withdrawal.id, withdrawalReference: `WD-${String(withdrawal.id).padStart(6, '0')}`, supplierName: withdrawal.wallet.organization.name, amount: withdrawal.amount, environment: withdrawal.environment, withdrawalStatus: withdrawal.status, attemptId: attempt?.id ?? null, provider: attempt?.provider ?? null, providerReference: attempt?.providerReference ?? null, attemptStatus: attempt?.status ?? null, attemptUpdatedAt: attempt?.updatedAt ?? null, warnings: diagnostics(withdrawal, attempt), requestedAt: withdrawal.requestedAt, approvedAt: withdrawal.approvedAt, completedAt: withdrawal.completedAt, payoutDestinationBank: withdrawal.payoutDestinationBank, payoutDestinationMasked: withdrawal.payoutDestinationMasked, payoutMethodTypeSnapshot: withdrawal.payoutMethodTypeSnapshot, reservationStatus: reservation?.status ?? null, reservationAmount: reservation?.amount ?? null, terminalLedgerStatus: terminalLedger?.status ?? null, terminalLedgerAmount: terminalLedger?.amount ?? null, walletBalance: withdrawal.wallet.balance, walletHeldBalance: withdrawal.wallet.heldBalance, legacyReviewed: Boolean(legacyReview), legacyReviewedAt: legacyReview?.createdAt ?? null, legacyReviewedById: legacyReview?.userId ?? null }; }).filter((row) => diagnostic ? row.warnings.includes(diagnostic) : args.needsReview ? row.warnings.some((warning) => warning !== 'LEGACY_NO_PAYOUT_ATTEMPT' || !row.legacyReviewed) : attemptStatus || withdrawalStatus || provider || startDate || endDate || search ? true : Boolean(row.attemptId) || row.warnings.some((warning) => warning !== 'LEGACY_NO_PAYOUT_ATTEMPT' || !row.legacyReviewed));
                const total = rows.length;
                return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
            } });
        t.nonNull.field('adminPayoutReconciliationSummary', { type: 'PayoutReconciliationSummary', args: { environment: nonNull(arg({ type: 'Environment' })) }, async resolve(_r, args, ctx) { requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_VIEW'); const [attempts, withdrawals, audits] = await Promise.all([ctx.prisma.withdrawalPayoutAttempt.groupBy({ by: ['status'], where: { environment: args.environment }, _count: { _all: true } }), ctx.prisma.withdrawal.findMany({ where: { environment: args.environment, deletedAt: null }, include: { wallet: { include: { ledgerEntries: { where: { sourceType: 'WITHDRAWAL', deletedAt: null } } } }, payoutAttempts: { orderBy: { updatedAt: 'desc' }, take: 1 } } }), ctx.prisma.auditLog.findMany({ where: { pageKey: 'payoutReconciliation', recordType: 'Withdrawal', deletedAt: null }, select: { recordId: true, newValue: true } })]); const count = (status) => attempts.find((row) => row.status === status)?._count._all ?? 0; const acknowledged = new Set(audits.filter((audit) => audit.newValue?.action === 'LEGACY_PAYOUT_RECONCILIATION_ACKNOWLEDGED').map((audit) => audit.recordId)); return { reconciliationRequired: count('RECONCILIATION_REQUIRED'), processing: count('PROCESSING'), failed: count('FAILED'), succeeded: count('SUCCEEDED'), needsReview: withdrawals.filter((withdrawal) => diagnostics(withdrawal, withdrawal.payoutAttempts[0]).some((warning) => warning !== 'LEGACY_NO_PAYOUT_ATTEMPT' || !acknowledged.has(String(withdrawal.id)))).length }; } });
    },
});
export const PayoutReconciliationMutations = extendType({ type: 'Mutation', definition(t) {
        t.nonNull.boolean('acknowledgeLegacyPayoutReconciliation', { args: { withdrawalId: nonNull(intArg()), note: nullable(stringArg()) }, async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                if (!Number.isInteger(args.withdrawalId) || args.withdrawalId < 1)
                    throw new Error('Withdrawal ID is invalid.');
                const note = args.note?.trim();
                if (note && (note.length < 5 || note.length > 500))
                    throw new Error('Operational note must be between 5 and 500 characters when provided.');
                const withdrawal = await ctx.prisma.withdrawal.findFirst({ where: { id: args.withdrawalId, deletedAt: null, environment: 'SANDBOX', status: 'COMPLETED', payoutAttempts: { none: {} } }, include: { wallet: { include: { ledgerEntries: { where: { sourceType: 'WITHDRAWAL', deletedAt: null } } } } } });
                if (!withdrawal)
                    throw new Error('Only completed sandbox withdrawals without a payout attempt can be acknowledged as legacy records.');
                const terminalLedger = withdrawal.wallet.ledgerEntries.find((entry) => entry.referenceId === `withdrawal-payout:${withdrawal.id}`);
                if (!terminalLedger)
                    throw new Error('Legacy payout acknowledgement requires a payout completion ledger.');
                await ctx.prisma.auditLog.create({ data: { orgId: Number(ctx.user?.orgId ?? 0), userId: Number(ctx.user?.id ?? ctx.user?.userId ?? 0), pageKey: 'payoutReconciliation', action: 'STATUS_CHANGE', recordType: 'Withdrawal', recordId: String(withdrawal.id), newValue: { action: 'LEGACY_PAYOUT_RECONCILIATION_ACKNOWLEDGED', note: note ?? null, environment: withdrawal.environment } } });
                return true;
            } });
        t.nonNull.field('refreshWithdrawalPayoutStatus', { type: 'PayoutReconciliationRow', args: { attemptId: nonNull(stringArg()) }, async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                const attemptId = args.attemptId.trim();
                if (!attemptId || attemptId.length > 100)
                    throw new Error('Payout attempt ID is invalid.');
                const attempt = await ctx.prisma.withdrawalPayoutAttempt.findUnique({
                    where: { id: attemptId },
                    include: { withdrawal: { include: { wallet: { include: { organization: { select: { name: true } }, ledgerEntries: { where: { sourceType: 'WITHDRAWAL', deletedAt: null } } } } } } },
                });
                if (!attempt)
                    throw new Error('Payout attempt not found.');
                if (attempt.environment !== 'PRODUCTION' || attempt.withdrawal.environment !== attempt.environment)
                    throw new Error('Payout attempt environment is invalid.');
                if (!attempt.providerReference)
                    throw new Error('Provider reference is missing; payout requires reconciliation.');
                // The only configured production adapter currently throws a safe domain error.
                const provider = getProductionPayoutProvider();
                await provider.getPayoutStatus(attempt.providerReference);
                throw new Error('Provider status could not be verified.');
            } });
        t.nonNull.field('addWithdrawalPayoutReconciliationNote', { type: 'PayoutReconciliationRow', args: { attemptId: nonNull(stringArg()), note: nonNull(stringArg()) }, async resolve(_r, args, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                const attemptId = args.attemptId.trim();
                const note = args.note.trim();
                if (!attemptId || attemptId.length > 100)
                    throw new Error('Payout attempt ID is invalid.');
                if (note.length < 5 || note.length > 500)
                    throw new Error('Reconciliation note must be between 5 and 500 characters.');
                const attempt = await ctx.prisma.withdrawalPayoutAttempt.update({ where: { id: attemptId }, data: { operationalNote: note }, include: { withdrawal: { include: { wallet: { include: { organization: { select: { name: true } }, ledgerEntries: { where: { sourceType: 'WITHDRAWAL', deletedAt: null } } } } } } } });
                await recordAudit(ctx, 'PAYOUT_RECONCILIATION_NOTE_ADDED', attempt.withdrawal, attempt, { note });
                const warnings = diagnostics(attempt.withdrawal, attempt);
                return { withdrawalId: attempt.withdrawal.id, withdrawalReference: `WD-${String(attempt.withdrawal.id).padStart(6, '0')}`, supplierName: attempt.withdrawal.wallet.organization.name, amount: attempt.withdrawal.amount, environment: attempt.environment, withdrawalStatus: attempt.withdrawal.status, attemptId: attempt.id, provider: attempt.provider, providerReference: attempt.providerReference, attemptStatus: attempt.status, attemptUpdatedAt: attempt.updatedAt, warnings };
            } });
    } });
