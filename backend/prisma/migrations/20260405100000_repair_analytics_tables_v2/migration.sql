-- Önceki migration kaydı olsa bile tablo oluşmamış DB'ler için tekrar (IF NOT EXISTS = idempotent).

CREATE TABLE IF NOT EXISTS "StepCompletionEvent" (
    "id" SERIAL NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "mainStepKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StepCompletionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StepCompletionEvent_productType_productId_mainStepKey_idx"
    ON "StepCompletionEvent"("productType", "productId", "mainStepKey");

CREATE INDEX IF NOT EXISTS "StepCompletionEvent_productType_completedAt_idx"
    ON "StepCompletionEvent"("productType", "completedAt");

CREATE TABLE IF NOT EXISTS "DepartmentWeekCapacity" (
    "id" SERIAL NOT NULL,
    "productType" TEXT NOT NULL,
    "mainStepKey" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "normalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentWeekCapacity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentWeekCapacity_productType_mainStepKey_weekStart_key"
    ON "DepartmentWeekCapacity"("productType", "mainStepKey", "weekStart");

CREATE INDEX IF NOT EXISTS "DepartmentWeekCapacity_productType_weekStart_idx"
    ON "DepartmentWeekCapacity"("productType", "weekStart");

CREATE TABLE IF NOT EXISTS "WeeklyStepTarget" (
    "id" SERIAL NOT NULL,
    "productType" TEXT NOT NULL,
    "mainStepKey" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyStepTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WeeklyStepTarget_productType_weekStart_idx"
    ON "WeeklyStepTarget"("productType", "weekStart");

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyStepTarget_productType_mainStepKey_weekStart_key"
    ON "WeeklyStepTarget"("productType", "mainStepKey", "weekStart");
