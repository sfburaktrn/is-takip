-- Firma bazlı bakım hatırlatma durumu (additive; mevcut veriyi etkilemez)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "reminderStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "reminderNote" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "reminderHandledAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "reminderHandledByUserId" INTEGER;

CREATE INDEX IF NOT EXISTS "Company_reminderStatus_idx" ON "Company"("reminderStatus");

DO $companyReminderFk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Company_reminderHandledByUserId_fkey'
      AND table_name = 'Company'
  ) THEN
    ALTER TABLE "Company"
      ADD CONSTRAINT "Company_reminderHandledByUserId_fkey"
      FOREIGN KEY ("reminderHandledByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$companyReminderFk$;
