-- CreateTable (idempotent for ensureSchema / partial apply recovery)
CREATE TABLE IF NOT EXISTS "SshTalepNoSequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SshTalepNoSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SshComplaint" (
    "id" SERIAL NOT NULL,
    "talepNo" TEXT NOT NULL,
    "talepTipi" TEXT NOT NULL,
    "sikayetBildirimTarihi" TIMESTAMP(3) NOT NULL,
    "garantiBaslangicTarihi" TIMESTAMP(3) NOT NULL,
    "musteriAdi" TEXT NOT NULL,
    "ilgiliKisi" TEXT,
    "ilgiliKisiTel" TEXT,
    "ustYapiTipi" TEXT NOT NULL,
    "sasiMarka" TEXT,
    "sasiModel" TEXT,
    "aracPlakasi" TEXT,
    "sasiNo" TEXT,
    "imalatNo" TEXT,
    "arizaBolge1" TEXT,
    "arizaBolge2" TEXT,
    "arizaBolge3" TEXT,
    "arizaTipi" TEXT,
    "arizaKodu" TEXT,
    "hataKaynagi" TEXT,
    "arizaAciklamasi" TEXT,
    "tekrarEdenHataSayisi" INTEGER NOT NULL DEFAULT 1,
    "aracCikisSuresiGun" INTEGER,
    "cikisSureKatsayisi" INTEGER,
    "oncelikPrio" TEXT NOT NULL DEFAULT 'PRİO 1',
    "oncelikKatsayisi" INTEGER,
    "etkiAdi" TEXT,
    "etkiKatsayisi" INTEGER,
    "analizPuani" INTEGER,
    "kritikPuan" INTEGER,
    "fabrikaGarantiKarari" TEXT,
    "garantiTipi" TEXT,
    "toplamTutar" DECIMAL(14,2),
    "onaylananTutar" DECIMAL(14,2),
    "faturaTarihi" TIMESTAMP(3),
    "onarim" TEXT,
    "onarimTarihi" TIMESTAMP(3),
    "kokNeden" TEXT,
    "kaliciOnlem" TEXT,
    "kaliciOnlemTarihi" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'AÇIK',
    "createdByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SshComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SshComplaint_talepNo_key" ON "SshComplaint"("talepNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SshComplaint_status_idx" ON "SshComplaint"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SshComplaint_kritikPuan_idx" ON "SshComplaint"("kritikPuan");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SshComplaint_createdAt_idx" ON "SshComplaint"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SshComplaint_musteriAdi_idx" ON "SshComplaint"("musteriAdi");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SshComplaint_aracPlakasi_idx" ON "SshComplaint"("aracPlakasi");
