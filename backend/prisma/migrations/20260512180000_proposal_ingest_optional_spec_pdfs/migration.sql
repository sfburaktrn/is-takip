-- Teklif Takip ingest: opsiyonel şartname ve ek PDF public URL'leri (geri uyumlu; sadece ekleme).
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "teknik_sartname_pdf_url" TEXT;
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "ek_pdf_url" TEXT;
