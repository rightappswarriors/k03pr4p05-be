-- Add agent relation to PurchaseOrder (nullable for manual POs)
ALTER TABLE "PurchaseOrder" ADD COLUMN "agentId" TEXT;

-- Add foreign key constraint to Agent table
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") NOT VALID;
ALTER TABLE "PurchaseOrder" VALIDATE CONSTRAINT "PurchaseOrder_agentId_fkey";

-- Add historical snapshot fields to POLineItem
ALTER TABLE "POLineItem" ADD COLUMN "itemName" TEXT;
ALTER TABLE "POLineItem" ADD COLUMN "itemSku" TEXT;
ALTER TABLE "POLineItem" ADD COLUMN "itemDescription" TEXT;

-- Make buyerOrgId relation optional (already nullable in schema, just ensuring consistency)
-- No DB change needed - buyerOrgId was already Int? in schema

-- Add index on agentId for query performance
CREATE INDEX "PurchaseOrder_agentId_idx" ON "PurchaseOrder" ("agentId");
