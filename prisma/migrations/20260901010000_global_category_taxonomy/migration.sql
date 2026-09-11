CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CategorySuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "imageUrl" TEXT,
  "iconUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" INTEGER,
  "reviewedByUserId" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategorySuggestion" (
  "id" TEXT NOT NULL,
  "proposedName" TEXT NOT NULL,
  "proposedDescription" TEXT,
  "parentCategoryId" TEXT,
  "organizationId" INTEGER NOT NULL,
  "submittedByUserId" INTEGER,
  "status" "CategorySuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "approvedCategoryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CategorySuggestion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupplierItem" ADD COLUMN "globalCategoryId" TEXT;

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Category_parentId_name_key" ON "Category"("parentId", "name");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX "Category_deletedAt_idx" ON "Category"("deletedAt");
CREATE INDEX "CategorySuggestion_organizationId_idx" ON "CategorySuggestion"("organizationId");
CREATE INDEX "CategorySuggestion_status_idx" ON "CategorySuggestion"("status");
CREATE INDEX "CategorySuggestion_parentCategoryId_idx" ON "CategorySuggestion"("parentCategoryId");
CREATE INDEX "SupplierItem_globalCategoryId_idx" ON "SupplierItem"("globalCategoryId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CategorySuggestion" ADD CONSTRAINT "CategorySuggestion_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CategorySuggestion" ADD CONSTRAINT "CategorySuggestion_approvedCategoryId_fkey" FOREIGN KEY ("approvedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CategorySuggestion" ADD CONSTRAINT "CategorySuggestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategorySuggestion" ADD CONSTRAINT "CategorySuggestion_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CategorySuggestion" ADD CONSTRAINT "CategorySuggestion_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
