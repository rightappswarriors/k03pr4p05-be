/*
  Warnings:

  - The values [SYNCED] on the enum `Status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `retryCount` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Status_new" AS ENUM ('PENDING', 'PAYED', 'FAILED', 'CANCELED');
ALTER TABLE "public"."Transaction" ALTER COLUMN "status" TYPE "public"."Status_new" USING ("status"::text::"public"."Status_new");
ALTER TYPE "public"."Status" RENAME TO "Status_old";
ALTER TYPE "public"."Status_new" RENAME TO "Status";
DROP TYPE "public"."Status_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "retryCount",
ALTER COLUMN "cashReceived" DROP NOT NULL,
ALTER COLUMN "change" DROP NOT NULL;
