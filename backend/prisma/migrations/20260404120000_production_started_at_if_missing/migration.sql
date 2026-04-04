-- Şema ile DB uyumsuzsa (P2022): sütun yoksa ekle, varsa atla. Mevcut satırlara dokunmaz.
ALTER TABLE "Damper" ADD COLUMN IF NOT EXISTS "productionStartedAt" TIMESTAMP(3);
ALTER TABLE "Dorse" ADD COLUMN IF NOT EXISTS "productionStartedAt" TIMESTAMP(3);
ALTER TABLE "Sasi" ADD COLUMN IF NOT EXISTS "productionStartedAt" TIMESTAMP(3);
