-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "itemId" INTEGER,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Media_itemId_sortOrder_idx" ON "Media"("itemId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
