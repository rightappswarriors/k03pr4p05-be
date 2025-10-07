/*
  Warnings:

  - You are about to drop the column `tax` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `vatAmount` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."Status" ADD VALUE 'SYNCED';

-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "tax",
ADD COLUMN     "vatAmount" DOUBLE PRECISION NOT NULL;
