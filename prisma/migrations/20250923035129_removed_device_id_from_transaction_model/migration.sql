/*
  Warnings:

  - You are about to drop the column `deviceId` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "deviceId";
