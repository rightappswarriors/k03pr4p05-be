-- PurchaseOrder is the immutable commercial snapshot used by both Portal and Kompra PH.
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "extraCharges" JSONB,
  ADD COLUMN IF NOT EXISTS "extraChargesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Payment preparation is not payment confirmation.  Add the state without
-- recreating the shared enum or touching historical PAID records.
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PREPARING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Safe backfill: POLineItem contains the historical price/quantity snapshot.
UPDATE "PurchaseOrder" po
SET "subtotalAmount" = COALESCE(items.subtotal, 0),
    "extraChargesTotal" = COALESCE(po."extraChargesTotal", 0)
FROM (
  SELECT "poId", SUM("subtotal") AS subtotal
  FROM "POLineItem"
  GROUP BY "poId"
) items
WHERE po.id = items."poId" AND po."subtotalAmount" = 0;
