-- AlterTable: make deliveryOutletId nullable on PurchaseOrder
-- Wholesale Purchase Orders do not use outlets. The deliveryOutletId
-- foreign key remains, but the column is now optional so PO creation
-- succeeds when no outlet exists for the buyer organization.
ALTER TABLE "PurchaseOrder" ALTER COLUMN "deliveryOutletId" DROP NOT NULL;
