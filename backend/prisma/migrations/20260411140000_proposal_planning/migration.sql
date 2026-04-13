-- AlterTable (nullable; mevcut satırlara dokunmaz)
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "planning_product_type" TEXT;
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "expected_delivery_days" INTEGER;
ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "target_delivery_date" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "proposal_ingest_approval_logged_at_idx" ON "proposal_ingest"("approval_logged_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "proposal_plan_segment" (
    "id" SERIAL NOT NULL,
    "proposal_ingest_id" INTEGER NOT NULL,
    "main_step_key" TEXT NOT NULL,
    "planned_start" TIMESTAMP(3) NOT NULL,
    "planned_end" TIMESTAMP(3) NOT NULL,
    "duration_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_plan_segment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "proposal_plan_segment_proposal_ingest_id_main_step_key_key" ON "proposal_plan_segment"("proposal_ingest_id", "main_step_key");
CREATE INDEX IF NOT EXISTS "proposal_plan_segment_proposal_ingest_id_idx" ON "proposal_plan_segment"("proposal_ingest_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposal_plan_segment_proposal_ingest_id_fkey'
    ) THEN
        ALTER TABLE "proposal_plan_segment" ADD CONSTRAINT "proposal_plan_segment_proposal_ingest_id_fkey"
            FOREIGN KEY ("proposal_ingest_id") REFERENCES "proposal_ingest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
