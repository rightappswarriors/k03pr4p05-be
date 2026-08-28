CREATE TYPE "OrganizationAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE "PlatformLedgerSourceType" AS ENUM ('TRANSACTION_FEE', 'SUBSCRIPTION_FEE', 'WITHDRAWAL_FEE', 'REFUND', 'REVERSAL', 'MANUAL_ADJUSTMENT');

ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'BANNED';

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "accountStatus" "OrganizationAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedById" INTEGER,
  ADD COLUMN IF NOT EXISTS "banReason" TEXT,
  ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bannedById" INTEGER;

ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedById" INTEGER,
  ADD COLUMN IF NOT EXISTS "banReason" TEXT,
  ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bannedById" INTEGER;

CREATE INDEX IF NOT EXISTS "Organization_accountStatus_idx" ON "Organization"("accountStatus");

CREATE TABLE IF NOT EXISTS "PlatformWallet" (
  "id" SERIAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "heldBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWallet_currency_key" ON "PlatformWallet"("currency");

CREATE TABLE IF NOT EXISTS "PlatformWalletLedgerEntry" (
  "id" TEXT NOT NULL,
  "walletId" INTEGER NOT NULL,
  "type" "LedgerEntryType" NOT NULL,
  "sourceType" "PlatformLedgerSourceType" NOT NULL,
  "referenceId" TEXT,
  "paymentTransactionId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "environment" "Environment" NOT NULL DEFAULT 'PRODUCTION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformWalletLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformWalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "PlatformWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_walletId_createdAt_idx" ON "PlatformWalletLedgerEntry"("walletId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_paymentTransactionId_idx" ON "PlatformWalletLedgerEntry"("paymentTransactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_walletId_sourceType_referenceId_key" ON "PlatformWalletLedgerEntry"("walletId", "sourceType", "referenceId");
