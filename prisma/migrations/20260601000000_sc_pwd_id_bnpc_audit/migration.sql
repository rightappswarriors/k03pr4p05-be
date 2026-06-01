ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" NOT NULL DEFAULT 'NONE';

ALTER TABLE "ScPwdCustomer"
  ADD COLUMN IF NOT EXISTS "oscaId" TEXT,
  ADD COLUMN IF NOT EXISTS "govId" TEXT,
  ADD COLUMN IF NOT EXISTS "bnpcCapManuallyReached" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bnpcCapManualReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ScPwdCustomer_oscaId_key" ON "ScPwdCustomer"("oscaId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScPwdCustomer_govId_key" ON "ScPwdCustomer"("govId");
CREATE INDEX IF NOT EXISTS "ScPwdCustomer_oscaId_idx" ON "ScPwdCustomer"("oscaId");
CREATE INDEX IF NOT EXISTS "ScPwdCustomer_govId_idx" ON "ScPwdCustomer"("govId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScPwdCustomer_orgId_fullName_contactNumber_dateOfBirth_oscaId_key"
  ON "ScPwdCustomer"("orgId", "fullName", "contactNumber", "dateOfBirth", "oscaId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScPwdCustomer_orgId_fullName_contactNumber_dateOfBirth_govId_key"
  ON "ScPwdCustomer"("orgId", "fullName", "contactNumber", "dateOfBirth", "govId");

ALTER TABLE "DiscountAudit"
  ADD COLUMN IF NOT EXISTS "oscaGovId" TEXT,
  ADD COLUMN IF NOT EXISTS "customItemName" TEXT,
  ADD COLUMN IF NOT EXISTS "isVoided" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

CREATE INDEX IF NOT EXISTS "DiscountAudit_customerId_createdAt_idx" ON "DiscountAudit"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "DiscountAudit_oscaGovId_createdAt_idx" ON "DiscountAudit"("oscaGovId", "createdAt");
CREATE INDEX IF NOT EXISTS "DiscountAudit_salesOrderId_idx" ON "DiscountAudit"("salesOrderId");
CREATE INDEX IF NOT EXISTS "DiscountAudit_transactionId_idx" ON "DiscountAudit"("transactionId");
CREATE INDEX IF NOT EXISTS "DiscountAudit_kompraOrderId_idx" ON "DiscountAudit"("kompraOrderId");
