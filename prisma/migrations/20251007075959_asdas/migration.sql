/*
  Warnings:

  - Made the column `outletId` on table `Inventory` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Inventory" ALTER COLUMN "outletId" SET NOT NULL;
