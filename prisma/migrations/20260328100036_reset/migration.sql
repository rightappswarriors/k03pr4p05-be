-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'GOLD');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('Active', 'On_Leave', 'Contract');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'CASHIER', 'OWNER');

-- CreateEnum
CREATE TYPE "OutletType" AS ENUM ('retail', 'wholesale', 'service');

-- CreateEnum
CREATE TYPE "OutletStatus" AS ENUM ('open', 'closed', 'maintenance');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH', 'E_WALLET');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'PAID', 'SYNCED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('gcash', 'paymaya', 'card', 'qrph');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'in_delivery', 'received', 'cancelled', 'returned');

-- CreateEnum
CREATE TYPE "DeliveryStatusEvent" AS ENUM ('order_placed', 'outlet_confirmed', 'outlet_preparing', 'rider_assigned', 'rider_picked_up', 'rider_en_route', 'arrived_at_door', 'delivered', 'cancelled', 'return_requested', 'returned');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('delivery', 'packaging', 'priority', 'handling', 'voucher_discount');

-- CreateEnum
CREATE TYPE "KompraCPaymentMethod" AS ENUM ('cash_on_delivery', 'gcash', 'paymaya', 'card', 'qrph');

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'BASIC',
    "expiresAt" TIMESTAMP(3),
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CASHIER',
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profilePhoto" TEXT,
    "managerId" INTEGER,
    "enabledPaymentMethod" BOOLEAN NOT NULL DEFAULT false,
    "contactNumber" TEXT,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymongoAPIKeys" (
    "id" SERIAL NOT NULL,
    "public_key" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,

    CONSTRAINT "PaymongoAPIKeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "locationId" INTEGER,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceLocation" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "branchId" INTEGER NOT NULL,

    CONSTRAINT "PlaceLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outlet" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "nextTransactionNumber" INTEGER DEFAULT 1,
    "governmentTax" DOUBLE PRECISION,
    "serviceCharge" DOUBLE PRECISION,
    "outletType" "OutletType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "wifiSSID" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "ownerId" INTEGER NOT NULL,
    "apiKeyId" INTEGER,
    "hasKey" BOOLEAN NOT NULL DEFAULT false,
    "status" "OutletStatus" NOT NULL DEFAULT 'open',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "imageBanner" TEXT,

    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "PromoType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletPromo" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "promoTypeId" INTEGER NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "OutletPromo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletStaff" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OutletStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnauthorizedAttempt" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "attemptedDeviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnauthorizedAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "outletId" INTEGER NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "aisle" TEXT,
    "rack" TEXT,
    "shelf" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItems" (
    "id" SERIAL NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "locationId" INTEGER,

    CONSTRAINT "InventoryItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "ItemGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cost_of_sale" TEXT,
    "description" TEXT,
    "groupType" TEXT,
    "sales" TEXT,
    "stocks" TEXT,
    "orgId" INTEGER NOT NULL,
    "groupId" INTEGER,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategoryMap" (
    "itemId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "ItemCategoryMap_pkey" PRIMARY KEY ("itemId","categoryId")
);

-- CreateTable
CREATE TABLE "Color" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "hexCode" TEXT,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "barcode" TEXT NOT NULL,
    "brand" TEXT,
    "orgId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "ServiceCharge" BOOLEAN NOT NULL DEFAULT false,
    "assembly" BOOLEAN NOT NULL DEFAULT false,
    "itemCode" TEXT,
    "skuNumber" TEXT,
    "vatExempt" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "type" "MediaType",
    "itemId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "webUrl" TEXT,
    "contactNumber" TEXT,
    "name" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemUnit" (
    "id" SERIAL NOT NULL,
    "unitName" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ItemUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "transactionId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("transactionId","itemId")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "cashierId" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "cashReceived" DOUBLE PRECISION,
    "change" DOUBLE PRECISION,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "Status" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerDetailsId" INTEGER,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDetails" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT,
    "username" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "paymentType" "PaymentType" NOT NULL,
    "paymentMethodId" TEXT,
    "paymentIntentId" TEXT,
    "client_key" TEXT,
    "status" TEXT,
    "transactionId" INTEGER NOT NULL,

    CONSTRAINT "CustomerDetails_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "InventoryItemUnit" (
    "id" SERIAL NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "unitName" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "baseUnit" TEXT NOT NULL DEFAULT 'piece',
    "barcode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minOrderQty" DOUBLE PRECISION,
    "maxOrderQty" DOUBLE PRECISION,
    "reorderPoint" DOUBLE PRECISION,

    CONSTRAINT "InventoryItemUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatType" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "VatType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCenter" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "SubCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTitle" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "AccountTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" "EmployeeStatus" NOT NULL,
    "salary" DOUBLE PRECISION NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GISRow" (
    "id" TEXT NOT NULL,
    "main" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "GISRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryRow" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "opExPct" DOUBLE PRECISION NOT NULL,
    "computedCost" DOUBLE PRECISION NOT NULL,
    "costContribution" DOUBLE PRECISION NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "SummaryRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "outlet" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "minStock" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "lowStock" BOOLEAN NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ColorToItem" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ColorToItem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ItemToItemUnit" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ItemToItemUnit_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_orgId_username_key" ON "User"("orgId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "User_orgId_email_key" ON "User"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PaymongoAPIKeys_ownerId_key" ON "PaymongoAPIKeys"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_orgId_name_key" ON "Branch"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceLocation_branchId_key" ON "PlaceLocation"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_code_key" ON "Outlet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_orgId_code_key" ON "Outlet"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PromoType_name_key" ON "PromoType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PromoType_orgId_name_key" ON "PromoType"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OutletPromo_outletId_promoTypeId_key" ON "OutletPromo"("outletId", "promoTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletStaff_outletId_userId_key" ON "OutletStaff"("outletId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_outletId_key" ON "Inventory"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItems_locationId_key" ON "InventoryItems"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItems_inventoryId_itemId_key" ON "InventoryItems"("inventoryId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemGroup_name_key" ON "ItemGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ItemGroup_orgId_name_key" ON "ItemGroup"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_name_key" ON "ItemCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_orgId_name_key" ON "ItemCategory"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Color_name_key" ON "Color"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "Item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Item_orgId_name_key" ON "Item"("orgId", "name");

-- CreateIndex
CREATE INDEX "Media_itemId_sortOrder_idx" ON "Media"("itemId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_orgId_name_key" ON "Brand"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnit_unitName_key" ON "ItemUnit"("unitName");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDetails_transactionId_key" ON "CustomerDetails"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "KompraCustomer_email_key" ON "KompraCustomer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KompraCustomer_phone_key" ON "KompraCustomer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDeviceToken_token_key" ON "CustomerDeviceToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "KompraCOrder_transactionNumber_key" ON "KompraCOrder"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KompraCOrderItem_orderId_inventoryItemId_key" ON "KompraCOrderItem"("orderId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "KompraCDeliveryTracking_orderId_statusAt_idx" ON "KompraCDeliveryTracking"("orderId", "statusAt");

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

-- CreateIndex
CREATE INDEX "InventoryItemUnit_inventoryItemId_idx" ON "InventoryItemUnit"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemUnit_inventoryItemId_unitName_key" ON "InventoryItemUnit"("inventoryItemId", "unitName");

-- CreateIndex
CREATE UNIQUE INDEX "VatType_orgId_label_key" ON "VatType"("orgId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Department_orgId_label_key" ON "Department"("orgId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Position_orgId_label_key" ON "Position"("orgId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Center_orgId_label_key" ON "Center"("orgId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "SubCenter_orgId_label_key" ON "SubCenter"("orgId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTitle_orgId_label_key" ON "AccountTitle"("orgId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_orgId_idx" ON "Employee"("orgId");

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "Employee"("department");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_orgId_email_key" ON "Employee"("orgId", "email");

-- CreateIndex
CREATE INDEX "GISRow_orgId_idx" ON "GISRow"("orgId");

-- CreateIndex
CREATE INDEX "SummaryRow_orgId_idx" ON "SummaryRow"("orgId");

-- CreateIndex
CREATE INDEX "SalesOrder_orgId_idx" ON "SalesOrder"("orgId");

-- CreateIndex
CREATE INDEX "InventoryItem_orgId_idx" ON "InventoryItem"("orgId");

-- CreateIndex
CREATE INDEX "_ColorToItem_B_index" ON "_ColorToItem"("B");

-- CreateIndex
CREATE INDEX "_ItemToItemUnit_B_index" ON "_ItemToItemUnit"("B");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymongoAPIKeys" ADD CONSTRAINT "PaymongoAPIKeys_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceLocation" ADD CONSTRAINT "PlaceLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "PaymongoAPIKeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoType" ADD CONSTRAINT "PromoType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoType" ADD CONSTRAINT "PromoType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPromo" ADD CONSTRAINT "OutletPromo_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPromo" ADD CONSTRAINT "OutletPromo_promoTypeId_fkey" FOREIGN KEY ("promoTypeId") REFERENCES "PromoType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPromo" ADD CONSTRAINT "OutletPromo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletStaff" ADD CONSTRAINT "OutletStaff_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletStaff" ADD CONSTRAINT "OutletStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItems" ADD CONSTRAINT "InventoryItems_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItems" ADD CONSTRAINT "InventoryItems_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItems" ADD CONSTRAINT "InventoryItems_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGroup" ADD CONSTRAINT "ItemGroup_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategoryMap" ADD CONSTRAINT "ItemCategoryMap_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategoryMap" ADD CONSTRAINT "ItemCategoryMap_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDetails" ADD CONSTRAINT "CustomerDetails_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "OutletDeliveryConfig" ADD CONSTRAINT "OutletDeliveryConfig_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletItemSearchIndex" ADD CONSTRAINT "OutletItemSearchIndex_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletItemSearchIndex" ADD CONSTRAINT "OutletItemSearchIndex_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletItemSearchIndex" ADD CONSTRAINT "OutletItemSearchIndex_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemUnit" ADD CONSTRAINT "InventoryItemUnit_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VatType" ADD CONSTRAINT "VatType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCenter" ADD CONSTRAINT "SubCenter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTitle" ADD CONSTRAINT "AccountTitle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GISRow" ADD CONSTRAINT "GISRow_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GISRow" ADD CONSTRAINT "GISRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryRow" ADD CONSTRAINT "SummaryRow_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryRow" ADD CONSTRAINT "SummaryRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ColorToItem" ADD CONSTRAINT "_ColorToItem_A_fkey" FOREIGN KEY ("A") REFERENCES "Color"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ColorToItem" ADD CONSTRAINT "_ColorToItem_B_fkey" FOREIGN KEY ("B") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemToItemUnit" ADD CONSTRAINT "_ItemToItemUnit_A_fkey" FOREIGN KEY ("A") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemToItemUnit" ADD CONSTRAINT "_ItemToItemUnit_B_fkey" FOREIGN KEY ("B") REFERENCES "ItemUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
