-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "supplierPaymentTerm" TEXT;

-- AlterTable
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "prevSupplierPaymentTerm" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN IF NOT EXISTS "supplierPaymentTerm" TEXT;
