-- CreateEnum
CREATE TYPE "public"."PaymentType" AS ENUM ('GCASH', 'PAYMAYA', 'CARD');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "enabledPaymentMethod" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."PaymongoAPIKeys" (
    "id" SERIAL NOT NULL,
    "public_key" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,

    CONSTRAINT "PaymongoAPIKeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentDetails" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT,
    "username" TEXT,
    "email" TEXT,
    "type" "public"."PaymentType" NOT NULL,
    "paymentMethodId" TEXT,
    "paymentIntentId" TEXT,
    "status" TEXT,
    "transactionId" INTEGER NOT NULL,

    CONSTRAINT "PaymentDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymongoAPIKeys_ownerId_key" ON "public"."PaymongoAPIKeys"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDetails_transactionId_key" ON "public"."PaymentDetails"("transactionId");

-- AddForeignKey
ALTER TABLE "public"."PaymongoAPIKeys" ADD CONSTRAINT "PaymongoAPIKeys_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentDetails" ADD CONSTRAINT "PaymentDetails_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
