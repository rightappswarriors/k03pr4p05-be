/*
  Warnings:

  - You are about to drop the column `brandName` on the `Brand` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `Brand` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Brand` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Brand` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "public"."Brand" DROP COLUMN "brandName",
DROP COLUMN "phoneNumber",
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "cost_of_sale" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "groupType" TEXT,
ADD COLUMN     "sales" TEXT,
ADD COLUMN     "stocks" TEXT;

-- AlterTable
ALTER TABLE "public"."Item" ADD COLUMN     "ServiceCharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assembly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemCode" TEXT,
ADD COLUMN     "skuNumber" TEXT,
ADD COLUMN     "vatExempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."StockLocation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ItemUnit" (
    "id" SERIAL NOT NULL,
    "unitName" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ItemUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "zipCode" TEXT,
    "contactNumber" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "faxNumber" TEXT,
    "tinNumber" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModeOfPayment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,

    CONSTRAINT "ModeOfPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ItemToItemUnit" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ItemToItemUnit_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnit_unitName_key" ON "public"."ItemUnit"("unitName");

-- CreateIndex
CREATE INDEX "_ItemToItemUnit_B_index" ON "public"."_ItemToItemUnit"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "public"."Brand"("name");

-- AddForeignKey
ALTER TABLE "public"."ModeOfPayment" ADD CONSTRAINT "ModeOfPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ItemToItemUnit" ADD CONSTRAINT "_ItemToItemUnit_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ItemToItemUnit" ADD CONSTRAINT "_ItemToItemUnit_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."ItemUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
