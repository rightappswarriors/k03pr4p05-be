-- CreateTable
CREATE TABLE "PromoType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- CreateIndex
CREATE UNIQUE INDEX "PromoType_name_key" ON "PromoType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OutletPromo_outletId_promoTypeId_key" ON "OutletPromo"("outletId", "promoTypeId");

-- AddForeignKey
ALTER TABLE "PromoType" ADD CONSTRAINT "PromoType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPromo" ADD CONSTRAINT "OutletPromo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPromo" ADD CONSTRAINT "OutletPromo_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPromo" ADD CONSTRAINT "OutletPromo_promoTypeId_fkey" FOREIGN KEY ("promoTypeId") REFERENCES "PromoType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
