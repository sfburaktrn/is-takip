-- Ürün kartları için serbest metin notu; mevcut satırlar korunur (yalnızca sütun eklenir).
ALTER TABLE "Damper" ADD COLUMN IF NOT EXISTS "cardNote" TEXT;
ALTER TABLE "Dorse" ADD COLUMN IF NOT EXISTS "cardNote" TEXT;
ALTER TABLE "Sasi" ADD COLUMN IF NOT EXISTS "cardNote" TEXT;
