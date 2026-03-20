/*
  Warnings:

  - You are about to drop the `EkumpraCDeliveryTracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EkumpraCOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EkumpraCOrderFee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EkumpraCOrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EkumpraCustomer` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "KompraCPaymentMethod" AS ENUM ('cash_on_delivery', 'gcash', 'paymaya', 'card', 'qrph');

-- DropForeignKey
ALTER TABLE "CustomerDeviceToken" DROP CONSTRAINT "CustomerDeviceToken_customerId_fkey";

-- DropForeignKey
ALTER TABLE "DeliveryAddress" DROP CONSTRAINT "DeliveryAddress_customerId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCDeliveryTracking" DROP CONSTRAINT "EkumpraCDeliveryTracking_orderId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrder" DROP CONSTRAINT "EkumpraCOrder_customerId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrder" DROP CONSTRAINT "EkumpraCOrder_deliveryAddressId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrder" DROP CONSTRAINT "EkumpraCOrder_outletId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrderFee" DROP CONSTRAINT "EkumpraCOrderFee_orderId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrderItem" DROP CONSTRAINT "EkumpraCOrderItem_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrderItem" DROP CONSTRAINT "EkumpraCOrderItem_itemId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrderItem" DROP CONSTRAINT "EkumpraCOrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "EkumpraCOrderItem" DROP CONSTRAINT "EkumpraCOrderItem_unitId_fkey";

-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "imageBanner" TEXT;

-- DropTable
DROP TABLE "EkumpraCDeliveryTracking";

-- DropTable
DROP TABLE "EkumpraCOrder";

-- DropTable
DROP TABLE "EkumpraCOrderFee";

-- DropTable
DROP TABLE "EkumpraCOrderItem";

-- DropTable
DROP TABLE "EkumpraCustomer";

-- DropEnum
DROP TYPE "EkumpraCPaymentMethod";

-- CreateTable
CREATE TABLE "KompraCustomer" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profilePhoto" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,

    CONSTRAINT "KompraCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KompraCOrder" (
    "id" SERIAL NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "outletId" INTEGER NOT NULL,
    "deliveryAddressId" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "scheduledDeliveryAt" TIMESTAMP(3),
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "paymentMethod" "KompraCPaymentMethod" NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentReference" TEXT,
    "riderName" TEXT,
    "riderPhone" TEXT,
    "customerNote" TEXT,
    "outletNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KompraCOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KompraCOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceSnapshot" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "unitId" INTEGER,

    CONSTRAINT "KompraCOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KompraCOrderFee" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" "FeeType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "KompraCOrderFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KompraCDeliveryTracking" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "event" "DeliveryStatusEvent" NOT NULL,
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "note" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" INTEGER,

    CONSTRAINT "KompraCDeliveryTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KompraCustomer_email_key" ON "KompraCustomer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KompraCustomer_phone_key" ON "KompraCustomer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "KompraCOrder_transactionNumber_key" ON "KompraCOrder"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KompraCOrderItem_orderId_inventoryItemId_key" ON "KompraCOrderItem"("orderId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "KompraCDeliveryTracking_orderId_statusAt_idx" ON "KompraCDeliveryTracking"("orderId", "statusAt");

-- AddForeignKey
ALTER TABLE "CustomerDeviceToken" ADD CONSTRAINT "CustomerDeviceToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "KompraCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAddress" ADD CONSTRAINT "DeliveryAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "KompraCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrder" ADD CONSTRAINT "KompraCOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "KompraCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrder" ADD CONSTRAINT "KompraCOrder_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "DeliveryAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrder" ADD CONSTRAINT "KompraCOrder_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrderItem" ADD CONSTRAINT "KompraCOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrderItem" ADD CONSTRAINT "KompraCOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrderItem" ADD CONSTRAINT "KompraCOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "KompraCOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrderItem" ADD CONSTRAINT "KompraCOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "InventoryItemUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCOrderFee" ADD CONSTRAINT "KompraCOrderFee_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "KompraCOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KompraCDeliveryTracking" ADD CONSTRAINT "KompraCDeliveryTracking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "KompraCOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
