-- Add Fren Programı step for Dorse (safe: default false; no data loss)
ALTER TABLE "Dorse"
ADD COLUMN "frenProgrami" BOOLEAN NOT NULL DEFAULT false;

