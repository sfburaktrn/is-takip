-- AlterTable
ALTER TABLE "StockUnitPriceHistory" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TRY';
