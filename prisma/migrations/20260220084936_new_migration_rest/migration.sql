/*
  Warnings:

  - You are about to drop the column `accountLink` on the `ModeOfPayment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ModeOfPayment" DROP COLUMN "accountLink";

-- DropEnum
DROP TYPE "AccountLink";
