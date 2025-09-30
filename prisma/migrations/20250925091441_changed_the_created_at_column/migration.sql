/*
  Warnings:

  - You are about to drop the column `createAt` on the `Branch` table. All the data in the column will be lost.
  - Made the column `barcode` on table `Item` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Branch" DROP COLUMN "createAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."Item" ALTER COLUMN "barcode" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Location" ALTER COLUMN "aisle" DROP NOT NULL,
ALTER COLUMN "rack" DROP NOT NULL,
ALTER COLUMN "shelf" DROP NOT NULL;
