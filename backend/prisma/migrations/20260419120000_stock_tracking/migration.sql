-- Stok takip tabloları (mevcut tablolara dokunulmaz).

CREATE TABLE "StockGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockGroup_name_key" ON "StockGroup"("name");

CREATE TABLE "StockItem" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "purchaseCode" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(18,4),
    "supplierName" TEXT,
    "supplierContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockItem_groupId_idx" ON "StockItem"("groupId");

CREATE INDEX "StockItem_description_idx" ON "StockItem"("description");

CREATE UNIQUE INDEX "StockItem_groupId_purchaseCode_key" ON "StockItem"("groupId", "purchaseCode");

CREATE TABLE "StockUnitPriceHistory" (
    "id" SERIAL NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "note" TEXT,

    CONSTRAINT "StockUnitPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockUnitPriceHistory_stockItemId_recordedAt_idx" ON "StockUnitPriceHistory"("stockItemId", "recordedAt");

ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StockGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockUnitPriceHistory" ADD CONSTRAINT "StockUnitPriceHistory_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
