-- CreateTable
CREATE TABLE IF NOT EXISTS "SheetStockDocument" (
    "id" SERIAL NOT NULL,
    "sheetItemId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PDF',
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFileName" TEXT,
    "note" TEXT,
    "uploadedByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SheetStockDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SheetStockDocument_sheetItemId_createdAt_idx"
ON "SheetStockDocument"("sheetItemId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SheetStockDocument_sheetItemId_fkey'
  ) THEN
    ALTER TABLE "SheetStockDocument"
      ADD CONSTRAINT "SheetStockDocument_sheetItemId_fkey"
      FOREIGN KEY ("sheetItemId") REFERENCES "SheetStockItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
