-- CreateTable
CREATE TABLE "DepartmentWeekCapacity" (
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

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentWeekCapacity_productType_mainStepKey_weekStart_key" ON "DepartmentWeekCapacity"("productType", "mainStepKey", "weekStart");

-- CreateIndex
CREATE INDEX "DepartmentWeekCapacity_productType_weekStart_idx" ON "DepartmentWeekCapacity"("productType", "weekStart");
