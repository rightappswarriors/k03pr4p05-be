/** Platform treasury posting is kept separate from organization wallet logic.
 * Every caller must provide the same Prisma transaction that finalizes payment.
 */
export async function getOrCreatePlatformWallet(prisma: any, environment: 'SANDBOX' | 'PRODUCTION', currency = 'PHP') {
  return prisma.platformWallet.upsert({
    where: { currency_environment: { currency, environment } },
    create: { currency, environment, balance: 0, heldBalance: 0 },
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
    where: { orgId_environment: { orgId: payment.supplierOrgId, environment: payment.environment } },
    create: { orgId: payment.supplierOrgId, environment: payment.environment, currency: 'PHP', balance: 0, heldBalance: 0 },
    update: {},
  });

  // A unique source/reference pair makes webhook retries safe. Only increment
  // balances after a ledger row was actually created.
  const existingSupplierCredit = await tx.walletLedgerEntry.findFirst({
    where: { walletId: supplierWallet.id, sourceType: 'ESCROW_HOLD', referenceId: payment.id },
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

  return payment;
}
