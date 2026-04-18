-- Stok hareketleri (giriş/çıkış) ve tedarikçi değişiklik geçmişi.
-- Mevcut StockItem / StockGroup / StockUnitPriceHistory tablolarına dokunulmaz.

CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4),
    "note" TEXT,
    "userId" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_stockItemId_recordedAt_idx" ON "StockMovement"("stockItemId", "recordedAt");
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "StockSupplierHistory" (
    "id" SERIAL NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "supplierName" TEXT,
    "supplierContact" TEXT,
    "note" TEXT,
    "userId" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSupplierHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockSupplierHistory_stockItemId_recordedAt_idx" ON "StockSupplierHistory"("stockItemId", "recordedAt");

ALTER TABLE "StockSupplierHistory"
  ADD CONSTRAINT "StockSupplierHistory_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockSupplierHistory"
  ADD CONSTRAINT "StockSupplierHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
