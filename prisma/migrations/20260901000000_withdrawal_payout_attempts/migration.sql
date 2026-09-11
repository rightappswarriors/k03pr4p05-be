CREATE TYPE "WithdrawalPayoutAttemptStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'RECONCILIATION_REQUIRED');

ALTER TABLE "Withdrawal"
  ADD COLUMN "payoutDestinationEncrypted" TEXT,
  ADD COLUMN "payoutDestinationMasked" TEXT,
  ADD COLUMN "payoutDestinationAccount" TEXT,
  ADD COLUMN "payoutDestinationBank" TEXT,
  ADD COLUMN "payoutMethodTypeSnapshot" "PayoutMethodType";

CREATE TABLE "WithdrawalPayoutAttempt" (
  "id" TEXT NOT NULL,
  "withdrawalId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "environment" "Environment" NOT NULL,
  "providerReference" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" "WithdrawalPayoutAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "failureCode" TEXT,
  "failureReason" TEXT,
  "operationalNote" TEXT,
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "WithdrawalPayoutAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_providerReference_key" ON "WithdrawalPayoutAttempt"("providerReference");
CREATE INDEX "WithdrawalPayoutAttempt_withdrawalId_status_idx" ON "WithdrawalPayoutAttempt"("withdrawalId", "status");
CREATE INDEX "WithdrawalPayoutAttempt_provider_environment_status_idx" ON "WithdrawalPayoutAttempt"("provider", "environment", "status");
ALTER TABLE "WithdrawalPayoutAttempt" ADD CONSTRAINT "WithdrawalPayoutAttempt_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
