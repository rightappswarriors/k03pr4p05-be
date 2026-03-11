-- DropForeignKey
ALTER TABLE "Outlet" DROP CONSTRAINT "Outlet_branchId_fkey";

-- AlterTable
ALTER TABLE "Outlet" ALTER COLUMN "branchId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
