-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "supplierLeadTime" TEXT;

-- AlterTable
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "prevSupplierLeadTime" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "supplierLeadTime" TEXT;
