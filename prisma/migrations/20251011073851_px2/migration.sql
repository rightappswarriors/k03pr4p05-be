-- AlterEnum
ALTER TYPE "public"."PaymentType" ADD VALUE 'qrph';

-- AlterTable
ALTER TABLE "public"."CustomerDetails" ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "customerDetailsId" INTEGER;
