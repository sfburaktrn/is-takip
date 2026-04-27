-- Add delivery fields for Damper and Dorse (non-destructive)
-- Existing columns remain intact; new columns are nullable to avoid breaking live data.

ALTER TABLE "Damper"
  ADD COLUMN IF NOT EXISTS "teslimSasiNo" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimEden" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimAlan" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimAlanFirma" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimNot" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimAt" TIMESTAMP(3);

ALTER TABLE "Dorse"
  ADD COLUMN IF NOT EXISTS "teslimSasiNo" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimEden" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimAlan" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimAracSahibi" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimNot" TEXT,
  ADD COLUMN IF NOT EXISTS "teslimAt" TIMESTAMP(3);

