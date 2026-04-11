-- AlterTable
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "teknik_pdf_url" TEXT;
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "manufacturing_not" TEXT;
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "manufacturing_aciliyet" TEXT;
