-- Day 21 keeps SupplierOutletLink as the canonical Supplier <-> Retailer
-- outlet relationship. Existing rows are retained and normalized using the
-- semantics established by 20260711000000_supplier_link_workspace.
ALTER TYPE "SupplierLinkStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "SupplierLinkStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "SupplierLinkStatus" ADD VALUE IF NOT EXISTS 'DISABLED';

ALTER TABLE "SupplierOutletLink"
  ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "requestedById" INTEGER,
  ADD COLUMN "reviewedById" INTEGER;

UPDATE "SupplierOutletLink"
SET
  "status" = CASE
    WHEN "status" IN ('ACTIVE', 'ACCEPTED') THEN 'APPROVED'::"SupplierLinkStatus"
    WHEN "status" IN ('BLOCKED') THEN 'REJECTED'::"SupplierLinkStatus"
    WHEN "status" IN ('PAUSED', 'ARCHIVED') THEN 'DISABLED'::"SupplierLinkStatus"
    ELSE 'PENDING'::"SupplierLinkStatus"
  END,
  "requestedAt" = "createdAt",
  "approvedAt" = CASE
    WHEN "status" IN ('ACTIVE', 'ACCEPTED') OR "isApproved" = TRUE
      THEN COALESCE("linkedAt", "updatedAt", "createdAt")
    ELSE NULL
  END,
  "rejectedAt" = CASE
    WHEN "status" = 'BLOCKED' THEN COALESCE("updatedAt", "createdAt")
    ELSE NULL
  END,
  "disabledAt" = CASE
    WHEN "status" IN ('PAUSED', 'ARCHIVED')
      THEN COALESCE("pausedAt", "archivedAt", "updatedAt", "createdAt")
    ELSE NULL
  END,
  "isApproved" = CASE WHEN "status" IN ('ACTIVE', 'ACCEPTED') OR "isApproved" = TRUE THEN TRUE ELSE FALSE END;

ALTER TABLE "SupplierOutletLink"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- The organization-level link predates Day 21 and remains available to
-- existing PurchaseOrder references. Normalize its shared enum values only;
-- Day 21 does not create or delete organization-link rows.
UPDATE "SupplierOrganizationLink"
SET
  "status" = CASE
    WHEN "status" IN ('ACTIVE', 'ACCEPTED') THEN 'APPROVED'::"SupplierLinkStatus"
    WHEN "status" = 'BLOCKED' THEN 'REJECTED'::"SupplierLinkStatus"
    WHEN "status" IN ('PAUSED', 'ARCHIVED') THEN 'DISABLED'::"SupplierLinkStatus"
    ELSE 'PENDING'::"SupplierLinkStatus"
  END,
  "isApproved" = CASE WHEN "status" IN ('ACTIVE', 'ACCEPTED') OR "isApproved" = TRUE THEN TRUE ELSE FALSE END;
