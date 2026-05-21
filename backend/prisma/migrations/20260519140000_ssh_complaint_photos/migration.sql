-- CreateTable (additive — mevcut SSH kayıtları korunur)
CREATE TABLE IF NOT EXISTS "SshComplaintPhoto" (
    "id" SERIAL NOT NULL,
    "sshComplaintId" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFileName" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SshComplaintPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SshComplaintPhoto_sshComplaintId_displayOrder_idx" ON "SshComplaintPhoto"("sshComplaintId", "displayOrder");

DO $$ BEGIN
    ALTER TABLE "SshComplaintPhoto" ADD CONSTRAINT "SshComplaintPhoto_sshComplaintId_fkey" FOREIGN KEY ("sshComplaintId") REFERENCES "SshComplaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
