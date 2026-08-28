/** Platform treasury posting is kept separate from organization wallet logic.
 * Every caller must provide the same Prisma transaction that finalizes payment.
 */
export async function getOrCreatePlatformWallet(prisma: any, currency = 'PHP') {
  return prisma.platformWallet.upsert({
    where: { currency },
    create: { currency, balance: 0, heldBalance: 0 },
    update: {},
  });
}

export async function settleSuccessfulPayment(tx: any, paymentId: string) {
  const payment = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId } });
  if (!payment.supplierOrgId) throw new Error('Payment is missing its supplier organization.');
  if (payment.netAmount < 0 || payment.feeAmount < 0 || payment.providerFeeAmount < 0) {
    throw new Error('Payment fee amounts cannot be negative.');
  }

  const supplierWallet = await tx.wallet.upsert({
    where: { orgId: payment.supplierOrgId },
    create: { orgId: payment.supplierOrgId, currency: 'PHP', balance: 0, heldBalance: 0 },
    update: {},
  });

  // A unique source/reference pair makes webhook retries safe. Only increment
  // balances after a ledger row was actually created.
  const existingSupplierCredit = await tx.walletLedgerEntry.findFirst({
    where: { walletId: supplierWallet.id, sourceType: 'RETAIL_ORDER', referenceId: payment.id },
  });
  if (!existingSupplierCredit) {
    const updatedWallet = await tx.wallet.update({
      where: { id: supplierWallet.id },
      data: { heldBalance: { increment: payment.netAmount } },
    });
    await tx.walletLedgerEntry.create({
      data: {
        walletId: supplierWallet.id, type: 'CREDIT', sourceType: 'ESCROW_HOLD',
        referenceId: payment.id, amount: payment.netAmount, balanceAfter: updatedWallet.balance,
        status: 'HELD', environment: payment.environment,
      },
    });
  }

  await tx.platformFeeRecord.upsert({
    where: { paymentTransactionId: payment.id },
    create: {
      paymentTransactionId: payment.id,
      purchaseOrderId: payment.relatedType === 'PURCHASE_ORDER' ? payment.relatedId : null,
      supplierOrgId: payment.supplierOrgId,
      grossAmount: payment.amount,
      feeAmount: payment.feeAmount,
      providerFeeAmount: payment.providerFeeAmount,
      netAmount: payment.netAmount,
      feeRuleId: payment.feeRuleId,
      feeSnapshot: payment.feeSnapshot,
      environment: payment.environment,
    },
    update: {},
  });

  if (payment.feeAmount > 0) {
    const platformWallet = await getOrCreatePlatformWallet(tx);
    const existingPlatformCredit = await tx.platformWalletLedgerEntry.findFirst({
      where: { walletId: platformWallet.id, sourceType: 'TRANSACTION_FEE', referenceId: payment.id },
    });
    if (!existingPlatformCredit) {
      const updatedPlatformWallet = await tx.platformWallet.update({
        where: { id: platformWallet.id }, data: { balance: { increment: payment.feeAmount } },
      });
      await tx.platformWalletLedgerEntry.create({
        data: {
          walletId: platformWallet.id, type: 'CREDIT', sourceType: 'TRANSACTION_FEE',
          referenceId: payment.id, paymentTransactionId: payment.id, amount: payment.feeAmount,
          balanceAfter: updatedPlatformWallet.balance,
          description: 'Kompra platform fee from successful payment settlement.',
          environment: payment.environment,
        },
      });
    }
  }
  return payment;
}

export async function adjustPlatformWallet(tx: any, amount: number, description: string, referenceId: string) {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Adjustment amount must not be zero.');
  const wallet = await getOrCreatePlatformWallet(tx);
  const existing = await tx.platformWalletLedgerEntry.findFirst({
    where: { walletId: wallet.id, sourceType: 'MANUAL_ADJUSTMENT', referenceId },
  });
  if (existing) throw new Error('This platform wallet adjustment has already been recorded.');
  const updated = await tx.platformWallet.update({
    where: { id: wallet.id }, data: { balance: { increment: amount } },
  });
  return tx.platformWalletLedgerEntry.create({
    data: { walletId: wallet.id, type: amount > 0 ? 'CREDIT' : 'DEBIT', sourceType: 'MANUAL_ADJUSTMENT', referenceId, amount, balanceAfter: updated.balance, description, environment: 'PRODUCTION' },
  });
}
