-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "isMainItem" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockItem_isMainItem_idx" ON "StockItem"("isMainItem");
