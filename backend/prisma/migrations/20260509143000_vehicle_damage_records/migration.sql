-- CreateTable
CREATE TABLE "VehicleDamageRecord" (
    "id" SERIAL NOT NULL,
    "sasiNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'KAYDI_GIRILDI',
    "responsiblesJson" JSONB NOT NULL,
    "processOwner" TEXT,
    "requiresPart" BOOLEAN NOT NULL DEFAULT false,
    "repairLocation" TEXT,
    "serviceDirection" TEXT,
    "cost" DECIMAL(14,2),
    "notes" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDamageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDamagePhoto" (
    "id" SERIAL NOT NULL,
    "vehicleDamageId" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFileName" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDamagePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleDamageRecord_sasiNo_idx" ON "VehicleDamageRecord"("sasiNo");

-- CreateIndex
CREATE INDEX "VehicleDamageRecord_status_idx" ON "VehicleDamageRecord"("status");

-- CreateIndex
CREATE INDEX "VehicleDamageRecord_createdAt_idx" ON "VehicleDamageRecord"("createdAt");

-- CreateIndex
CREATE INDEX "VehicleDamagePhoto_vehicleDamageId_displayOrder_idx" ON "VehicleDamagePhoto"("vehicleDamageId", "displayOrder");

-- AddForeignKey
ALTER TABLE "VehicleDamagePhoto" ADD CONSTRAINT "VehicleDamagePhoto_vehicleDamageId_fkey" FOREIGN KEY ("vehicleDamageId") REFERENCES "VehicleDamageRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
