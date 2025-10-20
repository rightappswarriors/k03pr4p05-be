/*
  Warnings:

  - You are about to drop the `PaymentDetails` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PaymentDetails" DROP CONSTRAINT "PaymentDetails_transactionId_fkey";

-- AlterTable
ALTER TABLE "public"."Item" ADD COLUMN     "brandId" INTEGER;

-- DropTable
DROP TABLE "public"."PaymentDetails";

-- CreateTable
CREATE TABLE "public"."Brand" (
    "id" SERIAL NOT NULL,
    "brandName" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "webUrl" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerDetails" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT,
    "username" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "paymentType" "public"."PaymentType" NOT NULL,
    "paymentMethodId" TEXT,
    "paymentIntentId" TEXT,
    "client_key" TEXT,
    "status" TEXT,
    "transactionId" INTEGER NOT NULL,

    CONSTRAINT "CustomerDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDetails_transactionId_key" ON "public"."CustomerDetails"("transactionId");

-- AddForeignKey
ALTER TABLE "public"."Item" ADD CONSTRAINT "Item_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDetails" ADD CONSTRAINT "CustomerDetails_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
