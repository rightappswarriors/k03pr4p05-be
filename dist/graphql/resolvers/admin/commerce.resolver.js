import { arg, extendType, intArg, nonNull, objectType, stringArg } from 'nexus';
import { requireAdminPermission } from '../../../lib/adminGovernance.js';
import { releaseSupplierFunds, verifySandboxPayoutMethod } from '../../../services/supplierSettlement.service.js';
import { approveWithdrawalReview } from '../../../services/adminWithdrawalReview.service.js';
import { completeSandboxWithdrawalPayout, failSandboxWithdrawalPayout } from '../../../services/withdrawalPayout.service.js';
import { sendToOrg } from '../../../lib/ws.js';
import { confirmSandboxPaymentThroughSettlementService, SettlementRelayError } from '../../../services/sandboxSettlementRelay.service.js';
const audit = (ctx, recordType, recordId, value) => ctx.prisma.auditLog.create({
    data: {
        orgId: Number(ctx.user?.orgId ?? 0),
        userId: Number(ctx.user?.id ?? ctx.user?.userId ?? 0),
        pageKey: 'commerceDashboardPage',
        action: 'STATUS_CHANGE',
        recordType,
        recordId,
        newValue: value,
    },
});
export const CommerceDashboardMetrics = objectType({
    name: 'CommerceDashboardMetrics',
    definition(t) {
        [
            'grossMerchandiseValue',
            'confirmedPayments',
            'kompraFeesEarned',
            'supplierFundsHeld',
            'supplierFundsAvailable',
            'pendingWithdrawals',
            'completedWithdrawals',
        ].forEach((field) => t.nonNull.float(field));
    },
});
export const CommercePaymentRow = objectType({
    name: 'CommercePaymentRow',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('provider');
        t.nonNull.string('status');
        t.nonNull.string('relatedId');
        t.nonNull.float('gross');
        t.nonNull.float('fee');
        t.nonNull.float('net');
        t.nonNull.string('environment');
        t.nonNull.dateTime('createdAt');
        t.nullable.string('poNumber');
        t.nullable.string('buyerName');
        t.nullable.string('supplierName');
        t.nullable.string('fundsStatus');
    },
});
export const SandboxPaymentReconciliationRow = objectType({
    name: 'SandboxPaymentReconciliationRow',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('poNumber');
        t.nullable.string('buyerName');
        t.nonNull.string('supplierName');
        t.nonNull.string('provider');
        t.nonNull.float('amount');
        t.nonNull.string('currency');
        t.nullable.string('gatewayReference');
        t.nullable.string('webhookStatus');
        t.nullable.dateTime('webhookReceivedAt');
        t.nullable.string('verificationResult');
        t.nonNull.string('status');
        t.nonNull.string('environment');
    },
});
export const AdminWithdrawalRow = objectType({
    name: 'AdminWithdrawalRow',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.float('amount');
        t.nonNull.field('status', { type: 'WithdrawalStatus' });
        t.nonNull.dateTime('requestedAt');
        t.nullable.string('sandboxReference');
        t.nonNull.string('supplierName');
        t.nonNull.string('payoutMethod');
        t.nonNull.string('environment');
    },
});
export const AdminPayoutMethodRow = objectType({ name: 'AdminPayoutMethodRow', definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('supplierName');
        t.nonNull.field('type', { type: 'PayoutMethodType' });
        t.nullable.string('bankName');
        t.nonNull.string('accountName');
        t.nonNull.string('maskedAccountNumber');
        t.nonNull.boolean('isVerified');
        t.nonNull.boolean('isActive');
        t.nonNull.boolean('isDefault');
        t.nonNull.field('environment', { type: 'Environment' });
        t.nonNull.dateTime('createdAt');
        t.nullable.dateTime('verifiedAt');
    } });
export const CommerceQueries = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.field('adminCommerceDashboard', {
            type: 'CommerceDashboardMetrics',
            async resolve(_r, _a, ctx) {
                requireAdminPermission(ctx, 'COMMERCE_DASHBOARD_VIEW');
                const [payments, wallets, withdrawals] = await Promise.all([
                    ctx.prisma.paymentTransaction.aggregate({
                        _sum: { amount: true },
                        where: { status: 'SUCCEEDED', deletedAt: null },
                    }),
                    ctx.prisma.paymentTransaction.aggregate({
                        _sum: { amount: true, feeAmount: true },
                        where: { status: 'SUCCEEDED', deletedAt: null },
                    }),
                    ctx.prisma.withdrawal.groupBy({
                        by: ['status'],
                        _sum: { amount: true },
                        where: { deletedAt: null },
                    }),
                ]);
                const walletTotals = await ctx.prisma.wallet.aggregate({
                    _sum: { balance: true, heldBalance: true },
                    where: { deletedAt: null },
                });
                const amountFor = (status) => withdrawals.find((row) => row.status === status)?._sum.amount ?? 0;
                return {
                    grossMerchandiseValue: payments._sum.amount ?? 0,
                    confirmedPayments: payments._sum.amount ?? 0,
                    kompraFeesEarned: wallets
                        ? await ctx.prisma.platformFeeRecord
                            .aggregate({ _sum: { feeAmount: true } })
                            .then((row) => row._sum.feeAmount ?? 0)
                        : 0,
                    supplierFundsHeld: walletTotals._sum.heldBalance ?? 0,
                    supplierFundsAvailable: walletTotals._sum.balance ?? 0,
                    pendingWithdrawals: amountFor('PENDING') + amountFor('APPROVED') + amountFor('PROCESSING'),
                    completedWithdrawals: amountFor('COMPLETED'),
                };
            },
        });
        t.nonNull.list.nonNull.field('adminCommercePayments', {
            type: 'CommercePaymentRow',
            async resolve(_r, _a, ctx) {
                requireAdminPermission(ctx, 'COMMERCE_DASHBOARD_VIEW');
                const payments = await ctx.prisma.paymentTransaction.findMany({
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                });
                const poIds = payments
                    .filter((p) => p.relatedType === 'PURCHASE_ORDER')
                    .map((p) => p.relatedId);
                const orders = await ctx.prisma.purchaseOrder.findMany({
                    where: { id: { in: poIds } },
                    include: { buyerOrg: true, supplierOrg: true },
                });
                const releases = await ctx.prisma.walletLedgerEntry.findMany({
                    where: {
                        sourceType: 'ESCROW_RELEASE',
                        referenceId: { in: payments.map((p) => p.id) },
                    },
                    select: { referenceId: true },
                });
                const postedSettlements = await ctx.prisma.purchaseOrderSettlement.findMany({
                    where: {
                        paymentTransactionId: { in: payments.map((p) => p.id) },
                        walletPostedAt: { not: null },
                        walletLedgerEntryId: { not: null },
                    },
                    select: { paymentTransactionId: true },
                });
                const released = new Set(releases.map((entry) => entry.referenceId));
                const posted = new Set(postedSettlements.map((settlement) => settlement.paymentTransactionId));
                const orderById = new Map(orders.map((order) => [
                    order.id,
                    {
                        id: order.id,
                        poNumber: order.poNumber,
                        buyerOrg: order.buyerOrg ? { name: order.buyerOrg.name } : null,
                        supplierOrg: { name: order.supplierOrg.name },
                    },
                ]));
                return payments.map((payment) => {
                    const order = orderById.get(payment.relatedId);
                    return {
                        id: payment.id,
                        provider: payment.provider,
                        status: payment.status,
                        relatedId: payment.relatedId,
                        gross: payment.amount,
                        fee: payment.feeAmount,
                        net: payment.netAmount,
                        environment: payment.environment,
                        createdAt: payment.createdAt,
                        poNumber: order?.poNumber ?? null,
                        buyerName: order?.buyerOrg?.name ?? null,
                        supplierName: order?.supplierOrg?.name ?? null,
                        fundsStatus: payment.status !== 'SUCCEEDED' ? null : released.has(payment.id) || posted.has(payment.id) ? 'AVAILABLE' : 'HELD',
                    };
                });
            },
        });
        t.nonNull.list.nonNull.field('adminSandboxPaymentReconciliations', {
            type: 'SandboxPaymentReconciliationRow',
            async resolve(_r, _a, ctx) {
                requireAdminPermission(ctx, 'WALLET_ADMIN');
                const payments = await ctx.prisma.paymentTransaction.findMany({
                    where: { deletedAt: null, status: { in: ['RECONCILIATION_REQUIRED', 'PROCESSING'] } },
                    orderBy: { createdAt: 'desc' }, take: 100,
                });
                const orders = await ctx.prisma.purchaseOrder.findMany({ where: { id: { in: payments.map((payment) => payment.relatedId) } }, include: { buyerOrg: { select: { name: true } }, supplierOrg: { select: { name: true } } } });
                const ordersById = new Map(orders.map((order) => [
                    order.id,
                    { id: order.id, poNumber: order.poNumber, buyerOrg: order.buyerOrg ? { name: order.buyerOrg.name } : null, supplierOrg: { name: order.supplierOrg.name } },
                ]));
                return payments
                    .map((payment) => {
                    const snapshot = (payment.feeSnapshot ?? {});
                    const evidence = snapshot.sandboxWebhookEvidence;
                    const verification = snapshot.providerVerification;
                    const order = ordersById.get(payment.relatedId);
                    return {
                        id: payment.id, poNumber: order?.poNumber ?? payment.relatedId, buyerName: order?.buyerOrg?.name ?? null,
                        supplierName: order?.supplierOrg?.name ?? 'Supplier', provider: payment.provider, amount: payment.amount, currency: 'PHP', gatewayReference: payment.gatewayReference,
                        webhookStatus: evidence?.status ?? null, webhookReceivedAt: evidence?.receivedAt ? new Date(evidence.receivedAt) : null,
                        verificationResult: verification?.providerCode ? `${verification.providerCode} — unavailable` : verification?.result ?? null,
                        status: payment.status, environment: payment.environment,
                    };
                })
                    .filter((payment) => payment.status === 'RECONCILIATION_REQUIRED' || payment.webhookStatus === 'PAYMENT_SUCCESS');
            },
        });
        t.nonNull.list.nonNull.field('adminCommerceWithdrawals', {
            type: 'AdminWithdrawalRow',
            async resolve(_r, _a, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_VIEW');
                const rows = await ctx.prisma.withdrawal.findMany({
                    where: { deletedAt: null },
                    include: { wallet: { include: { organization: true } }, payoutMethod: true },
                    orderBy: { requestedAt: 'desc' },
                    take: 100,
                });
                return rows.map((row) => ({
                    id: row.id,
                    amount: row.amount,
                    status: row.status,
                    requestedAt: row.requestedAt,
                    sandboxReference: row.sandboxReference,
                    supplierName: row.wallet.organization.name,
                    payoutMethod: `${row.payoutMethod.bankName ?? row.payoutMethod.type} • ${row.payoutMethod.maskedAccountNumber}`,
                    environment: row.environment,
                }));
            },
        });
        t.nonNull.list.nonNull.field('adminPayoutMethods', { type: 'AdminPayoutMethodRow', async resolve(_r, _a, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                const methods = await ctx.prisma.payoutMethod.findMany({ where: { deletedAt: null }, include: { organization: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
                return methods.map((method) => ({ id: method.id, supplierName: method.organization.name, type: method.type, bankName: method.bankName, accountName: method.accountName, maskedAccountNumber: method.maskedAccountNumber, isVerified: method.isVerified, isActive: method.isActive, isDefault: method.isDefault, environment: method.environment, createdAt: method.createdAt, verifiedAt: method.verifiedAt }));
            } });
    },
});
export const CommerceMutations = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('adminReleaseSupplierFunds', {
            type: 'Wallet',
            args: { paymentTransactionId: nonNull(stringArg()) },
            async resolve(_r, a, ctx) {
                requireAdminPermission(ctx, 'WALLET_ADMIN');
                const result = await ctx.prisma.$transaction((tx) => releaseSupplierFunds(tx, a.paymentTransactionId));
                await audit(ctx, 'PaymentTransaction', a.paymentTransactionId, {
                    action: 'FUNDS_RELEASED',
                    released: result.released,
                });
                return result.wallet;
            },
        });
        t.nonNull.field('adminConfirmSandboxPaymentReconciliation', {
            type: 'PaymentTransaction',
            args: { paymentTransactionId: nonNull(stringArg()), reason: nonNull(stringArg()) },
            async resolve(_r, a, ctx) {
                requireAdminPermission(ctx, 'WALLET_ADMIN');
                if (process.env.NODE_ENV === 'production' || process.env.SANDBOX_SETTLEMENT_MODE !== 'true')
                    throw new Error('Sandbox payment settlement is disabled.');
                const baseUrl = process.env.KOMPRA_WEB_API_URL;
                const serviceKey = process.env.SANDBOX_SETTLEMENT_SERVICE_KEY;
                if (!baseUrl || !serviceKey)
                    throw new SettlementRelayError('SETTLEMENT_SERVICE_NOT_CONFIGURED', 'Sandbox settlement service is not configured. No payment status was changed.');
                const actorUserId = Number(ctx.user?.id ?? ctx.user?.userId ?? 0);
                const actorOrgId = Number(ctx.user?.orgId ?? 0);
                const confirmation = await confirmSandboxPaymentThroughSettlementService({
                    baseUrl,
                    serviceKey,
                    paymentTransactionId: a.paymentTransactionId,
                    reason: a.reason,
                    actorUserId,
                    actorOrgId,
                    timeoutMs: Number(process.env.SANDBOX_SETTLEMENT_TIMEOUT_MS ?? 10_000),
                });
                const payment = await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: a.paymentTransactionId } });
                if (!confirmation.alreadyConfirmed)
                    await audit(ctx, 'SANDBOX_PAYMENT_MANUALLY_CONFIRMED', payment.id, {
                        actorId: actorUserId, actorOrgId, paymentTransactionId: payment.id, poId: payment.relatedId,
                        provider: payment.provider, amount: payment.amount, currency: 'PHP', gatewayReference: payment.gatewayReference,
                        environment: payment.environment, reason: a.reason.trim(), confirmedAt: new Date().toISOString(),
                        evidenceSnapshot: payment.feeSnapshot?.sandboxReconciliationAudit?.evidence ?? null,
                    });
                return payment;
            },
        });
        t.nonNull.field('adminVerifySandboxPayoutMethod', {
            type: 'PayoutMethod',
            args: { payoutMethodId: nonNull(intArg()) },
            async resolve(_r, a, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                const method = await ctx.prisma.$transaction((tx) => verifySandboxPayoutMethod(tx, a.payoutMethodId));
                await audit(ctx, 'PayoutMethod', String(method.id), {
                    action: 'PAYOUT_METHOD_VERIFIED',
                });
                return method;
            },
        });
        t.nonNull.field('adminApproveWithdrawal', {
            type: 'Withdrawal',
            args: { withdrawalId: nonNull(intArg()) },
            async resolve(_r, a, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                if (!Number.isInteger(a.withdrawalId) || a.withdrawalId < 1)
                    throw new Error('Withdrawal ID must be a positive integer.');
                const actor = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
                if (!Number.isInteger(actor.id) || actor.id < 1)
                    throw new Error('Authenticated administrator identity is required.');
                const result = await ctx.prisma.$transaction((tx) => approveWithdrawalReview(tx, a.withdrawalId, actor), { isolationLevel: 'Serializable' });
                sendToOrg(result.supplierOrgId, 'withdrawal:updated', { withdrawalId: result.withdrawal.id, status: result.withdrawal.status });
                sendToOrg(result.supplierOrgId, 'wallet:updated', { walletId: result.wallet.id });
                return result.withdrawal;
            },
        });
        t.nonNull.field('adminSimulateSandboxPayout', {
            type: 'Withdrawal',
            args: {
                withdrawalId: nonNull(intArg()),
                outcome: arg({ type: 'SandboxPayoutOutcome' }),
            },
            async resolve(_r, a, ctx) {
                requireAdminPermission(ctx, 'WITHDRAWAL_ADMIN_MANAGE');
                if (!Number.isInteger(a.withdrawalId) || a.withdrawalId < 1)
                    throw new Error('Withdrawal ID must be a positive integer.');
                const actor = { id: Number(ctx.user?.id ?? ctx.user?.userId), orgId: Number(ctx.user?.orgId ?? 0) };
                if (!Number.isInteger(actor.id) || actor.id < 1)
                    throw new Error('Authenticated administrator identity is required.');
                const result = await ctx.prisma.$transaction((tx) => a.outcome === 'FAILURE'
                    ? failSandboxWithdrawalPayout(tx, a.withdrawalId, 'Sandbox payout failure test.', actor)
                    : completeSandboxWithdrawalPayout(tx, a.withdrawalId, actor), { isolationLevel: 'Serializable' });
                const updated = result.withdrawal;
                await audit(ctx, 'Withdrawal', String(updated.id), {
                    action: updated.status === 'COMPLETED' ? 'WITHDRAWAL_COMPLETED' : 'WITHDRAWAL_FAILED',
                    sandboxReference: updated.sandboxReference,
                });
                sendToOrg(result.supplierOrgId, 'withdrawal:updated', { withdrawalId: updated.id, status: updated.status });
                sendToOrg(result.supplierOrgId, 'wallet:updated', { walletId: result.walletId });
                return updated;
            },
        });
    },
});
