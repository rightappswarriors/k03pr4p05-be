-- AlterTable
ALTER TABLE "EkumpraCOrderItem" ADD COLUMN     "unitId" INTEGER;

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

-- CreateIndex
CREATE INDEX "InventoryItemUnit_inventoryItemId_idx" ON "InventoryItemUnit"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemUnit_inventoryItemId_unitName_key" ON "InventoryItemUnit"("inventoryItemId", "unitName");

-- AddForeignKey
ALTER TABLE "EkumpraCOrderItem" ADD CONSTRAINT "EkumpraCOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "InventoryItemUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemUnit" ADD CONSTRAINT "InventoryItemUnit_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
