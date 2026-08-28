ALTER TABLE "PayoutMethod"
  ADD COLUMN "environment" "Environment" NOT NULL DEFAULT 'PRODUCTION';

ALTER TABLE "Withdrawal"
  ADD COLUMN "sandboxReference" TEXT;

CREATE UNIQUE INDEX "Withdrawal_sandboxReference_key"
  ON "Withdrawal"("sandboxReference");

ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TABLE "PlatformFeeRecord" (
  "id" TEXT NOT NULL,
  "paymentTransactionId" TEXT NOT NULL,
  "purchaseOrderId" TEXT,
  "supplierOrgId" INTEGER,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "feeAmount" DOUBLE PRECISION NOT NULL,
  "providerFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "feeRuleId" TEXT,
  "feeSnapshot" JSONB,
  "environment" "Environment" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformFeeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformFeeRecord_paymentTransactionId_key"
  ON "PlatformFeeRecord"("paymentTransactionId");
CREATE INDEX "PlatformFeeRecord_createdAt_idx"
  ON "PlatformFeeRecord"("createdAt");
CREATE INDEX "PlatformFeeRecord_supplierOrgId_createdAt_idx"
  ON "PlatformFeeRecord"("supplierOrgId", "createdAt");
CREATE INDEX "PlatformFeeRecord_purchaseOrderId_idx"
  ON "PlatformFeeRecord"("purchaseOrderId");
