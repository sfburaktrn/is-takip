-- CreateTable
CREATE TABLE IF NOT EXISTS "StockItemDocument" (
    "id" SERIAL NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRODUCT_IMAGE',
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFileName" TEXT,
    "note" TEXT,
    "supplierName" TEXT,
    "supplierContact" TEXT,
    "uploadedByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockItemDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockItemDocument_stockItemId_createdAt_idx" ON "StockItemDocument"("stockItemId", "createdAt");

-- AddForeignKey
DO $stockDocFk$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockItemDocument_stockItemId_fkey'
    ) THEN
        ALTER TABLE "StockItemDocument"
        ADD CONSTRAINT "StockItemDocument_stockItemId_fkey"
        FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $stockDocFk$;
