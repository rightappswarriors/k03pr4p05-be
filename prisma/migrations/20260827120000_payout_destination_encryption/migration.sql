ALTER TABLE "PayoutMethod" ADD COLUMN "encryptedDestination" TEXT NOT NULL DEFAULT 'LEGACY_MASKED_DESTINATION_NOT_EXECUTABLE';
ALTER TABLE "PayoutMethod" ADD COLUMN "encryptionKeyVersion" TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE "PayoutMethod" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
-- Existing masked-only records cannot be safely executed. They are retained but inactive.
UPDATE "PayoutMethod" SET "isActive" = false;
