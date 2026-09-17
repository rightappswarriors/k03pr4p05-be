import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';

const poNumber = process.argv.find((arg) => arg.startsWith('--po='))?.slice('--po='.length).trim();
if (!poNumber) throw new Error('Usage: npm run verify:supplier-wallet-escrow -- --po=<purchase-order-number>');

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

try {
  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { poNumber },
    select: {
      id: true,
      poNumber: true,
      status: true,
      paymentStatus: true,
      supplierConfirmation: true,
      buyerConfirmedAt: true,
      supplierOrgId: true,
      totalAmount: true,
    },
  });
  const payment = await prisma.paymentTransaction.findFirstOrThrow({
    where: { relatedType: 'PURCHASE_ORDER', relatedId: po.id, status: 'SUCCEEDED', deletedAt: null },
  });
  const feeRecord = await prisma.platformFeeRecord.findUniqueOrThrow({
    where: { paymentTransactionId: payment.id },
  });
  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { orgId_environment: { orgId: po.supplierOrgId, environment: payment.environment } },
  });
  const escrowEntries = await prisma.walletLedgerEntry.findMany({
    where: {
      walletId: wallet.id,
      sourceType: 'ESCROW_HOLD',
      referenceId: payment.id,
      deletedAt: null,
    },
  });
  const allActiveHeldEntries = await prisma.walletLedgerEntry.findMany({
    where: { walletId: wallet.id, status: 'HELD', deletedAt: null },
  });
  const settlement = await prisma.purchaseOrderSettlement.findUnique({ where: { purchaseOrderId: po.id } });

  assert.equal(payment.amount, po.totalAmount, 'Payment gross must match the Purchase Order total.');
  assert.equal(money(payment.amount - payment.feeAmount), payment.netAmount, 'Gross minus platform fee must equal Supplier net.');
  assert.equal(feeRecord.grossAmount, payment.amount, 'Platform fee record gross must match the payment.');
  assert.equal(feeRecord.feeAmount, payment.feeAmount, 'Platform fee record fee must match the payment.');
  assert.equal(feeRecord.netAmount, payment.netAmount, 'Platform fee record Supplier net must match the payment.');
  assert.equal(payment.supplierOrgId, wallet.orgId, 'Payment and wallet Supplier organization must match.');
  assert.equal(payment.environment, wallet.environment, 'Payment and wallet environments must match.');
  assert.equal(escrowEntries.length, 1, 'The successful payment must have exactly one escrow hold.');
  assert.equal(escrowEntries[0].amount, payment.netAmount, 'Escrow hold must equal Supplier net.');
  assert.equal(
    money(allActiveHeldEntries.reduce((sum, entry) => sum + entry.amount, 0)),
    wallet.heldBalance,
    'Active held ledger entries must reconcile to Wallet.heldBalance.',
  );

  let settlementPostingCount = 0;
  let platformFeePostingCount = 0;
  if (po.status === 'COMPLETED') {
    assert(settlement, 'A completed, paid PO must have an immutable settlement.');
    settlementPostingCount = await prisma.walletLedgerEntry.count({
      where: { walletId: wallet.id, sourceType: 'PURCHASE_ORDER_SETTLEMENT', referenceId: settlement.id, deletedAt: null },
    });
    platformFeePostingCount = await prisma.platformWalletLedgerEntry.count({
      where: { sourceType: 'PURCHASE_ORDER_PLATFORM_FEE', referenceId: settlement.id, environment: payment.environment },
    });
    assert.equal(settlementPostingCount, 1, 'Completed settlement must post Supplier funds exactly once.');
    assert.equal(platformFeePostingCount, payment.feeAmount > 0 ? 1 : 0, 'Completed settlement must post its platform fee exactly once.');
    assert.equal(escrowEntries[0].status, 'RELEASED', 'Completed settlement must release the matching escrow hold.');
  } else {
    assert.equal(settlement, null, 'An uncompleted PO must not have an early settlement.');
    assert.equal(escrowEntries[0].status, 'HELD', 'An uncompleted PO must retain its escrow hold.');
  }

  console.info(JSON.stringify({
    result: 'PASS',
    poNumber: po.poNumber,
    poStatus: po.status,
    paymentStatus: payment.status,
    environment: payment.environment,
    grossAmount: payment.amount,
    platformFee: payment.feeAmount,
    supplierNet: payment.netAmount,
    walletId: wallet.id,
    walletOrgId: wallet.orgId,
    availableBalance: wallet.balance,
    heldBalance: wallet.heldBalance,
    exactPaymentEscrowStatus: escrowEntries[0].status,
    exactPaymentEscrowAmount: escrowEntries[0].amount,
    activeHeldLedgerTotal: money(allActiveHeldEntries.reduce((sum, entry) => sum + entry.amount, 0)),
    settlementExists: Boolean(settlement),
    settlementPostingCount,
    platformFeePostingCount,
  }));
} finally {
  await prisma.$disconnect();
}
