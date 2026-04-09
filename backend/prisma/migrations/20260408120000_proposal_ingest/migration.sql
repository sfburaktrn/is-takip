-- Yeni tablo: mevcut tablolara dokunulmaz, yalnızca Teklif Takip entegrasyonu.
CREATE TABLE IF NOT EXISTS "proposal_ingest" (
    "id" SERIAL NOT NULL,
    "source_proposal_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "proposal_date" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "equipment" TEXT,
    "vehicle" TEXT,
    "volume" TEXT,
    "thickness" TEXT,
    "delivery_date" TIMESTAMP(3),
    "contact_person" TEXT,
    "notes" TEXT,
    "owner_email" TEXT,
    "pushed_at" TIMESTAMP(3) NOT NULL,
    "pushed_by" TEXT,
    "approval_logged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_ingest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "proposal_ingest_source_proposal_id_key" ON "proposal_ingest"("source_proposal_id");
CREATE INDEX IF NOT EXISTS "proposal_ingest_pushed_at_idx" ON "proposal_ingest"("pushed_at");
