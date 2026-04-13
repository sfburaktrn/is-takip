-- Bir teklifte miktar kadar ayrı araç (satır) planı: unit_index
ALTER TABLE "proposal_plan_segment" ADD COLUMN IF NOT EXISTS "unit_index" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "proposal_plan_segment_proposal_ingest_id_main_step_key_key";

CREATE UNIQUE INDEX IF NOT EXISTS "proposal_plan_segment_proposal_ingest_id_unit_index_main_step_key_key"
    ON "proposal_plan_segment"("proposal_ingest_id", "unit_index", "main_step_key");
