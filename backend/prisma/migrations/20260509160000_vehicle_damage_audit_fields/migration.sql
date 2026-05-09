-- AlterTable
ALTER TABLE "VehicleDamageRecord" ADD COLUMN "createdByUsername" TEXT;
ALTER TABLE "VehicleDamageRecord" ADD COLUMN "processStartedAt" TIMESTAMPTZ;
ALTER TABLE "VehicleDamageRecord" ADD COLUMN "processStartedByUsername" TEXT;
ALTER TABLE "VehicleDamageRecord" ADD COLUMN "completedAt" TIMESTAMPTZ;
ALTER TABLE "VehicleDamageRecord" ADD COLUMN "completedByUsername" TEXT;
