ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "imalata_alindi" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "proposal_ingest_imalata_alindi_idx" ON "proposal_ingest"("imalata_alindi");
