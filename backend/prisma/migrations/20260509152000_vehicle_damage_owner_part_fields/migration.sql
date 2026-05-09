-- AlterTable
ALTER TABLE "VehicleDamageRecord"
ADD COLUMN IF NOT EXISTS "processOwner" TEXT,
ADD COLUMN IF NOT EXISTS "requiresPart" BOOLEAN NOT NULL DEFAULT false;
