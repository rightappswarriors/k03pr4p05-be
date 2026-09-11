const sandboxEnabled = () => process.env.NODE_ENV !== 'production' && process.env.SANDBOX_SETTLEMENT_MODE === 'true';
export function requireSandboxSettlementMode() {
    if (!sandboxEnabled())
        throw new Error('Sandbox settlement actions are disabled.');
}
const actorId = (ctx) => Number(ctx.user?.id ?? ctx.user?.userId ?? 0);
export async function releaseSupplierFunds(tx, paymentTransactionId) {
    const payment = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: paymentTransactionId } });
    if (payment.status !== 'SUCCEEDED')
        throw new Error('Only confirmed payments can be released.');
    if (!payment.supplierOrgId)
        throw new Error('Payment is missing its supplier organization.');
    if (payment.relatedType === 'PURCHASE_ORDER') {
        throw new Error('Purchase order funds must be released through immutable settlement posting.');
    }
    const wallet = await tx.wallet.findFirstOrThrow({ where: { orgId: payment.supplierOrgId, environment: payment.environment } });
    const existing = await tx.walletLedgerEntry.findFirst({
        where: { walletId: wallet.id, sourceType: 'ESCROW_RELEASE', referenceId: payment.id },
    });
    if (existing)
        return { wallet: await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } }), released: false };
    const heldEntry = await tx.walletLedgerEntry.findFirst({
        where: { walletId: wallet.id, sourceType: 'ESCROW_HOLD', referenceId: payment.id, status: 'HELD' },
    });
    if (!heldEntry)
        throw new Error('No held supplier funds exist for this payment.');
    if (wallet.heldBalance < payment.netAmount)
        throw new Error('Wallet held balance cannot cover this release.');
    const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { heldBalance: { decrement: payment.netAmount }, balance: { increment: payment.netAmount } },
    });
    await tx.walletLedgerEntry.create({
        data: { walletId: wallet.id, type: 'CREDIT', sourceType: 'ESCROW_RELEASE', referenceId: payment.id, amount: payment.netAmount, balanceAfter: updated.balance, status: 'AVAILABLE', environment: payment.environment },
    });
    await tx.walletLedgerEntry.update({ where: { id: heldEntry.id }, data: { status: 'RELEASED' } });
    return { wallet: updated, released: true };
}
export async function requestWithdrawal(tx, { orgId, payoutMethodId, amount, requestedById }) {
    if (!Number.isFinite(amount) || amount <= 0)
        throw new Error('Amount must be greater than zero.');
    const payoutMethod = await tx.payoutMethod.findFirst({ where: { id: payoutMethodId, orgId, deletedAt: null, isActive: true } });
    if (!payoutMethod)
        throw new Error('Payout method not found.');
    if (!payoutMethod.isVerified)
        throw new Error('A verified payout method is required before withdrawing.');
    const wallet = await tx.wallet.findFirst({ where: { orgId, environment: payoutMethod.environment, deletedAt: null } });
    if (!wallet)
        throw new Error('Wallet not found for this payout method environment.');
    const reserved = await tx.wallet.updateMany({ where: { id: wallet.id, balance: { gte: amount } }, data: { balance: { decrement: amount }, heldBalance: { increment: amount } } });
    if (reserved.count !== 1)
        throw new Error('Insufficient available balance.');
    const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const withdrawal = await tx.withdrawal.create({ data: { walletId: wallet.id, payoutMethodId, amount, status: 'PENDING', requestedById, environment: wallet.environment, payoutDestinationEncrypted: payoutMethod.encryptedDestination, payoutDestinationMasked: payoutMethod.maskedAccountNumber, payoutDestinationAccount: payoutMethod.accountName, payoutDestinationBank: payoutMethod.bankName, payoutMethodTypeSnapshot: payoutMethod.type } });
    await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, type: 'DEBIT', sourceType: 'WITHDRAWAL', referenceId: `withdrawal:${withdrawal.id}`, amount: -amount, balanceAfter: updatedWallet.balance, status: 'HELD', environment: wallet.environment } });
    return withdrawal;
}
export async function verifySandboxPayoutMethod(tx, payoutMethodId) {
    requireSandboxSettlementMode();
    const method = await tx.payoutMethod.findUniqueOrThrow({ where: { id: payoutMethodId } });
    if (method.environment !== 'SANDBOX' || !method.isActive)
        throw new Error('Only active sandbox payout methods can be manually verified.');
    return tx.payoutMethod.update({ where: { id: method.id }, data: { isVerified: true, verifiedAt: new Date() } });
}
export async function processSandboxWithdrawal(tx, withdrawalId, outcome) {
    requireSandboxSettlementMode();
    const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId }, include: { payoutMethod: true, wallet: true } });
    if (withdrawal.environment !== 'SANDBOX' || withdrawal.payoutMethod.environment !== 'SANDBOX')
        throw new Error('Only sandbox withdrawals can be simulated.');
    if (withdrawal.status === 'COMPLETED')
        return withdrawal;
    if (!['PENDING', 'APPROVED', 'PROCESSING'].includes(withdrawal.status))
        throw new Error('This withdrawal cannot be processed.');
    if (!withdrawal.payoutMethod.isVerified)
        throw new Error('Withdrawal payout method is not verified.');
    const routing = (withdrawal.payoutMethod.bankName ?? '').toLowerCase();
    const resolved = outcome ?? (routing.includes('bpi') ? 'DELAYED' : routing.includes('metrobank') ? 'FAILURE' : 'SUCCESS');
    if (resolved === 'DELAYED')
        return tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'PROCESSING' } });
    if (resolved === 'FAILURE')
        return tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'FAILED', rejectionReason: 'Sandbox payout simulation failed.' } });
    if (withdrawal.wallet.balance < withdrawal.amount)
        throw new Error('Insufficient available balance at payout completion.');
    const reference = withdrawal.sandboxReference ?? `SBX-PAYOUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(withdrawal.id).padStart(4, '0')}`;
    const duplicate = await tx.walletLedgerEntry.findFirst({ where: { walletId: withdrawal.walletId, sourceType: 'WITHDRAWAL', referenceId: `withdrawal:${withdrawal.id}` } });
    if (duplicate)
        return tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'COMPLETED', completedAt: withdrawal.completedAt ?? new Date(), sandboxReference: reference } });
    const wallet = await tx.wallet.update({ where: { id: withdrawal.walletId }, data: { balance: { decrement: withdrawal.amount } } });
    await tx.walletLedgerEntry.create({ data: { walletId: withdrawal.walletId, type: 'DEBIT', sourceType: 'WITHDRAWAL', referenceId: `withdrawal:${withdrawal.id}`, amount: -withdrawal.amount, balanceAfter: wallet.balance, status: 'AVAILABLE', environment: 'SANDBOX' } });
    return tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'COMPLETED', completedAt: new Date(), sandboxReference: reference } });
}
export function currentActorId(ctx) { return actorId(ctx); }
