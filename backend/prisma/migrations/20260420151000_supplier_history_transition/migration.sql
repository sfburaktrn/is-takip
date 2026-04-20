-- Store supplier transition (prev -> next) in one row
ALTER TABLE "StockSupplierHistory" ADD COLUMN "prevSupplierName" TEXT;
ALTER TABLE "StockSupplierHistory" ADD COLUMN "prevSupplierContact" TEXT;

