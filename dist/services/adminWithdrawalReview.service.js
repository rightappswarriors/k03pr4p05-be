const pendingStatusError = (status) => {
    if (status === 'APPROVED')
        return 'This withdrawal has already been approved.';
    if (status === 'REJECTED')
        return 'This withdrawal has already been rejected.';
    return 'This withdrawal is no longer pending review.';
};
const loadPendingWithdrawal = async (tx, withdrawalId) => {
    const withdrawal = await tx.withdrawal.findFirst({
        where: { id: withdrawalId, deletedAt: null },
        include: { wallet: true },
    });
    if (!withdrawal)
        throw new Error('Withdrawal not found.');
    if (withdrawal.status !== 'PENDING')
        throw new Error(pendingStatusError(withdrawal.status));
    if (withdrawal.wallet.environment !== withdrawal.environment) {
        throw new Error('Withdrawal wallet environment does not match the request.');
    }
    return withdrawal;
};
export async function approveWithdrawalReview(tx, withdrawalId, actor) {
    const withdrawal = await loadPendingWithdrawal(tx, withdrawalId);
    const approvedAt = new Date();
    const transitioned = await tx.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'PENDING', deletedAt: null },
        data: { status: 'APPROVED', approvedById: actor.id, approvedAt },
    });
    if (transitioned.count !== 1)
        throw new Error('This withdrawal is no longer pending review.');
    const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } });
    await tx.auditLog.create({
        data: {
            orgId: actor.orgId,
            userId: actor.id,
            pageKey: 'withdrawalReview',
            action: 'STATUS_CHANGE',
            recordType: 'Withdrawal',
            recordId: String(updated.id),
            oldValue: { status: 'PENDING' },
            newValue: { action: 'WITHDRAWAL_APPROVED', status: 'APPROVED', environment: updated.environment },
        },
    });
    return { withdrawal: updated, supplierOrgId: withdrawal.wallet.orgId, wallet: withdrawal.wallet };
}
export async function rejectWithdrawalReview(tx, withdrawalId, reason, actor) {
    const withdrawal = await loadPendingWithdrawal(tx, withdrawalId);
    const reservation = await tx.walletLedgerEntry.findFirst({
        where: {
            walletId: withdrawal.walletId,
            sourceType: 'WITHDRAWAL',
            referenceId: `withdrawal:${withdrawal.id}`,
            status: 'HELD',
            deletedAt: null,
        },
    });
    if (!reservation)
        throw new Error('The original withdrawal reservation was not found.');
    const reviewedAt = new Date();
    const transitioned = await tx.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'PENDING', deletedAt: null },
        data: {
            status: 'REJECTED',
            rejectionReason: reason,
            approvedById: actor.id,
            approvedAt: reviewedAt,
        },
    });
    if (transitioned.count !== 1)
        throw new Error('This withdrawal is no longer pending review.');
    const restored = await tx.wallet.updateMany({
        where: { id: withdrawal.walletId, heldBalance: { gte: withdrawal.amount }, deletedAt: null },
        data: { balance: { increment: withdrawal.amount }, heldBalance: { decrement: withdrawal.amount } },
    });
    if (restored.count !== 1)
        throw new Error('Wallet held balance cannot cover this withdrawal reservation.');
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: withdrawal.walletId } });
    await tx.walletLedgerEntry.update({ where: { id: reservation.id }, data: { status: 'RELEASED' } });
    await tx.walletLedgerEntry.create({
        data: {
            walletId: wallet.id,
            type: 'CREDIT',
            sourceType: 'WITHDRAWAL',
            referenceId: `withdrawal-rejection:${withdrawal.id}`,
            amount: withdrawal.amount,
            balanceAfter: wallet.balance,
            status: 'AVAILABLE',
            environment: withdrawal.environment,
        },
    });
    const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } });
    await tx.auditLog.create({
        data: {
            orgId: actor.orgId,
            userId: actor.id,
            pageKey: 'withdrawalReview',
            action: 'STATUS_CHANGE',
            recordType: 'Withdrawal',
            recordId: String(updated.id),
            oldValue: { status: 'PENDING' },
            newValue: {
                action: 'WITHDRAWAL_REJECTED',
                status: 'REJECTED',
                environment: updated.environment,
                rejectionReason: reason,
            },
        },
    });
    return { withdrawal: updated, supplierOrgId: wallet.orgId, wallet };
}
