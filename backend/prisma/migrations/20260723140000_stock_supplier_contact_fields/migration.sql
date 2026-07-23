-- AlterTable StockItem
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "supplierPhone" TEXT;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "supplierEmail" TEXT;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "supplierContactName" TEXT;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "supplierContactPhone" TEXT;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "supplierContactEmail" TEXT;

-- AlterTable StockSupplierHistory
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "prevSupplierPhone" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "prevSupplierEmail" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "prevSupplierContactName" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "prevSupplierContactPhone" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "prevSupplierContactEmail" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "supplierPhone" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "supplierEmail" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "supplierContactName" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "supplierContactPhone" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "supplierContactEmail" TEXT;
