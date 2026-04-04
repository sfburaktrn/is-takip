-- AlterTable
ALTER TABLE "Damper" ADD COLUMN     "productionStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Dorse" ADD COLUMN     "productionStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Sasi" ADD COLUMN     "productionStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StepCompletionEvent" (
    "id" SERIAL NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "mainStepKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepCompletionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StepCompletionEvent_productType_productId_mainStepKey_idx" ON "StepCompletionEvent"("productType", "productId", "mainStepKey");

-- CreateIndex
CREATE INDEX "StepCompletionEvent_productType_completedAt_idx" ON "StepCompletionEvent"("productType", "completedAt");
