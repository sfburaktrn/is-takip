-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "criticalQuantity" DECIMAL(18,4);
