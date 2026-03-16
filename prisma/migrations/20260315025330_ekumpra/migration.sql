/*
  Warnings:

  - You are about to drop the `ModeOfPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Supplier` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'in_delivery', 'received', 'cancelled', 'returned');

-- CreateEnum
CREATE TYPE "DeliveryStatusEvent" AS ENUM ('order_placed', 'outlet_confirmed', 'outlet_preparing', 'rider_assigned', 'rider_picked_up', 'rider_en_route', 'arrived_at_door', 'delivered', 'cancelled', 'return_requested', 'returned');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('delivery', 'packaging', 'priority', 'handling', 'voucher_discount');

-- CreateEnum
CREATE TYPE "EkumpraCPaymentMethod" AS ENUM ('cash_on_delivery', 'gcash', 'paymaya', 'card', 'qrph');

-- DropForeignKey
ALTER TABLE "ModeOfPayment" DROP CONSTRAINT "ModeOfPayment_supplierId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "groupId" INTEGER;

-- DropTable
DROP TABLE "ModeOfPayment";

-- DropTable
DROP TABLE "Supplier";

-- DropEnum
DROP TYPE "AccountLink";

-- CreateTable
CREATE TABLE "ItemGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategoryMap" (
    "itemId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "ItemCategoryMap_pkey" PRIMARY KEY ("itemId","categoryId")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "type" "MediaType",

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EkumpraCustomer" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profilePhoto" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EkumpraCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDeviceToken" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAddress" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EkumpraCOrder" (
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
    "paymentMethod" "EkumpraCPaymentMethod" NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentReference" TEXT,
    "riderName" TEXT,
    "riderPhone" TEXT,
    "customerNote" TEXT,
    "outletNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EkumpraCOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EkumpraCOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceSnapshot" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EkumpraCOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EkumpraCOrderFee" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" "FeeType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EkumpraCOrderFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EkumpraCDeliveryTracking" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "event" "DeliveryStatusEvent" NOT NULL,
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "note" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" INTEGER,

    CONSTRAINT "EkumpraCDeliveryTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletDeliveryConfig" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "isDeliveryActive" BOOLEAN NOT NULL DEFAULT true,
    "deliveryRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "baseDeliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "feePerKm" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "minOrderAmount" DOUBLE PRECISION,
    "maxOrderAmount" DOUBLE PRECISION,
    "avgPrepMins" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "OutletDeliveryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletItemSearchIndex" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "outletLatitude" DOUBLE PRECISION NOT NULL,
    "outletLongitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OutletItemSearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemGroup_name_key" ON "ItemGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EkumpraCustomer_email_key" ON "EkumpraCustomer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EkumpraCustomer_phone_key" ON "EkumpraCustomer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDeviceToken_token_key" ON "CustomerDeviceToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EkumpraCOrder_transactionNumber_key" ON "EkumpraCOrder"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EkumpraCOrderItem_orderId_inventoryItemId_key" ON "EkumpraCOrderItem"("orderId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "EkumpraCDeliveryTracking_orderId_statusAt_idx" ON "EkumpraCDeliveryTracking"("orderId", "statusAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutletDeliveryConfig_outletId_key" ON "OutletDeliveryConfig"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletItemSearchIndex_inventoryItemId_key" ON "OutletItemSearchIndex"("inventoryItemId");

-- CreateIndex
CREATE INDEX "OutletItemSearchIndex_itemId_quantity_idx" ON "OutletItemSearchIndex"("itemId", "quantity");

-- CreateIndex
CREATE INDEX "OutletItemSearchIndex_outletId_idx" ON "OutletItemSearchIndex"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletItemSearchIndex_outletId_itemId_key" ON "OutletItemSearchIndex"("outletId", "itemId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategoryMap" ADD CONSTRAINT "ItemCategoryMap_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategoryMap" ADD CONSTRAINT "ItemCategoryMap_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDeviceToken" ADD CONSTRAINT "CustomerDeviceToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "EkumpraCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAddress" ADD CONSTRAINT "DeliveryAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "EkumpraCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCOrder" ADD CONSTRAINT "EkumpraCOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "EkumpraCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCOrder" ADD CONSTRAINT "EkumpraCOrder_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCOrder" ADD CONSTRAINT "EkumpraCOrder_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "DeliveryAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCOrderItem" ADD CONSTRAINT "EkumpraCOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EkumpraCOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCOrderItem" ADD CONSTRAINT "EkumpraCOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCOrderItem" ADD CONSTRAINT "EkumpraCOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCOrderFee" ADD CONSTRAINT "EkumpraCOrderFee_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EkumpraCOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EkumpraCDeliveryTracking" ADD CONSTRAINT "EkumpraCDeliveryTracking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EkumpraCOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletDeliveryConfig" ADD CONSTRAINT "OutletDeliveryConfig_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletItemSearchIndex" ADD CONSTRAINT "OutletItemSearchIndex_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletItemSearchIndex" ADD CONSTRAINT "OutletItemSearchIndex_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletItemSearchIndex" ADD CONSTRAINT "OutletItemSearchIndex_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
