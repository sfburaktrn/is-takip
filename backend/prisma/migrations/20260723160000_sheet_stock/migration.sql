-- CreateTable
CREATE TABLE IF NOT EXISTS "SheetStockItem" (
    "id" SERIAL NOT NULL,
    "material" TEXT NOT NULL,
    "thickness" DECIMAL(18,4) NOT NULL,
    "width" DECIMAL(18,4) NOT NULL,
    "length" DECIMAL(18,4) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "criticalQuantity" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SheetStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SheetStockMovement" (
    "id" SERIAL NOT NULL,
    "sheetItemId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4),
    "note" TEXT,
    "userId" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SheetStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SheetStockItem_material_thickness_width_length_key"
ON "SheetStockItem"("material", "thickness", "width", "length");

CREATE INDEX IF NOT EXISTS "SheetStockItem_material_idx" ON "SheetStockItem"("material");

CREATE INDEX IF NOT EXISTS "SheetStockMovement_sheetItemId_recordedAt_idx"
ON "SheetStockMovement"("sheetItemId", "recordedAt");

CREATE INDEX IF NOT EXISTS "SheetStockMovement_type_idx" ON "SheetStockMovement"("type");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SheetStockMovement_sheetItemId_fkey'
  ) THEN
    ALTER TABLE "SheetStockMovement"
      ADD CONSTRAINT "SheetStockMovement_sheetItemId_fkey"
      FOREIGN KEY ("sheetItemId") REFERENCES "SheetStockItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SheetStockMovement_userId_fkey'
  ) THEN
    ALTER TABLE "SheetStockMovement"
      ADD CONSTRAINT "SheetStockMovement_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
