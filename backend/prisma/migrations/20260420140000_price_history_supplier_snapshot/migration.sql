-- Birim fiyat satırında o andaki tedarikçiyi saklamak için
ALTER TABLE "StockUnitPriceHistory" ADD COLUMN "supplierName" TEXT;
ALTER TABLE "StockUnitPriceHistory" ADD COLUMN "supplierContact" TEXT;
