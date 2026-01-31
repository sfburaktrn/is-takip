/*
  Warnings:

  - A unique constraint covering the columns `[sasiId]` on the table `Dorse` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Dorse" ADD COLUMN     "sasiId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Dorse_sasiId_key" ON "Dorse"("sasiId");

-- AddForeignKey
ALTER TABLE "Dorse" ADD CONSTRAINT "Dorse_sasiId_fkey" FOREIGN KEY ("sasiId") REFERENCES "Sasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
