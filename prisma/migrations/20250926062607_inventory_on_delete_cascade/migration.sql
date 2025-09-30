-- DropForeignKey
ALTER TABLE "public"."Inventory" DROP CONSTRAINT "Inventory_outletId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InventoryItems" DROP CONSTRAINT "InventoryItems_locationId_fkey";

-- AlterTable
ALTER TABLE "public"."Inventory" ALTER COLUMN "outletId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Inventory" ADD CONSTRAINT "Inventory_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "public"."Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItems" ADD CONSTRAINT "InventoryItems_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
