-- CreateEnum
CREATE TYPE "OutletStatus" AS ENUM ('open', 'closed', 'maintainance');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "locationId" INTEGER;

-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "apiKeyId" INTEGER,
ADD COLUMN     "hasKey" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "OutletStatus" NOT NULL DEFAULT 'open';

-- CreateTable
CREATE TABLE "PlaceLocation" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "branchId" INTEGER NOT NULL,

    CONSTRAINT "PlaceLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceLocation_branchId_key" ON "PlaceLocation"("branchId");

-- AddForeignKey
ALTER TABLE "PlaceLocation" ADD CONSTRAINT "PlaceLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "PaymongoAPIKeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
