-- CreateTable
CREATE TABLE "Damper" (
    "id" SERIAL NOT NULL,
    "imalatNo" INTEGER,
    "musteri" TEXT NOT NULL,
    "aracGeldiMi" BOOLEAN NOT NULL DEFAULT false,
    "aracMarka" TEXT,
    "model" TEXT,
    "tip" TEXT NOT NULL,
    "malzemeCinsi" TEXT NOT NULL,
    "m3" DOUBLE PRECISION,
    "plazmaProgrami" BOOLEAN NOT NULL DEFAULT false,
    "sacMalzemeKontrolu" BOOLEAN NOT NULL DEFAULT false,
    "plazmaKesim" BOOLEAN NOT NULL DEFAULT false,
    "damperSasiPlazmaKesim" BOOLEAN NOT NULL DEFAULT false,
    "presBukum" BOOLEAN NOT NULL DEFAULT false,
    "aracBraket" BOOLEAN NOT NULL DEFAULT false,
    "damperSasi" BOOLEAN NOT NULL DEFAULT false,
    "sasiYukleme" BOOLEAN NOT NULL DEFAULT false,
    "milAltKutuk" BOOLEAN NOT NULL DEFAULT false,
    "taban" BOOLEAN NOT NULL DEFAULT false,
    "yan" BOOLEAN NOT NULL DEFAULT false,
    "onGogus" BOOLEAN NOT NULL DEFAULT false,
    "arkaKapak" BOOLEAN NOT NULL DEFAULT false,
    "yuklemeMalzemesi" BOOLEAN NOT NULL DEFAULT false,
    "damperKurulmasi" BOOLEAN NOT NULL DEFAULT false,
    "damperKaynak" BOOLEAN NOT NULL DEFAULT false,
    "sasiKapakSiperlik" BOOLEAN NOT NULL DEFAULT false,
    "yukleme" BOOLEAN NOT NULL DEFAULT false,
    "hidrolik" BOOLEAN NOT NULL DEFAULT false,
    "boyaHazirlik" BOOLEAN NOT NULL DEFAULT false,
    "boya" BOOLEAN NOT NULL DEFAULT false,
    "elektrik" BOOLEAN NOT NULL DEFAULT false,
    "hava" BOOLEAN NOT NULL DEFAULT false,
    "tamamlama" BOOLEAN NOT NULL DEFAULT false,
    "sonKontrol" BOOLEAN NOT NULL DEFAULT false,
    "kurumMuayenesi" TEXT NOT NULL DEFAULT 'YOK',
    "dmoMuayenesi" TEXT NOT NULL DEFAULT 'MUAYENE YOK',
    "teslimat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "sasiNo" TEXT,

    CONSTRAINT "Damper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dorse" (
    "id" SERIAL NOT NULL,
    "imalatNo" INTEGER,
    "musteri" TEXT NOT NULL,
    "cekiciGeldiMi" BOOLEAN NOT NULL DEFAULT false,
    "dingil" TEXT,
    "lastik" TEXT,
    "tampon" TEXT,
    "kalinlik" TEXT,
    "m3" DOUBLE PRECISION,
    "plazmaProgrami" BOOLEAN NOT NULL DEFAULT false,
    "sacMalzemeKontrolu" BOOLEAN NOT NULL DEFAULT false,
    "plazmaKesim" BOOLEAN NOT NULL DEFAULT false,
    "presBukum" BOOLEAN NOT NULL DEFAULT false,
    "dorseSasi" BOOLEAN NOT NULL DEFAULT false,
    "milAltKutuk" BOOLEAN NOT NULL DEFAULT false,
    "taban" BOOLEAN NOT NULL DEFAULT false,
    "yan" BOOLEAN NOT NULL DEFAULT false,
    "onGogus" BOOLEAN NOT NULL DEFAULT false,
    "arkaKapak" BOOLEAN NOT NULL DEFAULT false,
    "yuklemeMalzemesi" BOOLEAN NOT NULL DEFAULT false,
    "dorseKurulmasi" BOOLEAN NOT NULL DEFAULT false,
    "dorseKaynak" BOOLEAN NOT NULL DEFAULT false,
    "kapakSiperlik" BOOLEAN NOT NULL DEFAULT false,
    "yukleme" BOOLEAN NOT NULL DEFAULT false,
    "hidrolik" BOOLEAN NOT NULL DEFAULT false,
    "boyaHazirlik" BOOLEAN NOT NULL DEFAULT false,
    "dorseSasiBoyama" BOOLEAN NOT NULL DEFAULT false,
    "fren" BOOLEAN NOT NULL DEFAULT false,
    "dorseElektrik" BOOLEAN NOT NULL DEFAULT false,
    "tamamlama" BOOLEAN NOT NULL DEFAULT false,
    "cekiciElektrik" BOOLEAN NOT NULL DEFAULT false,
    "cekiciHidrolik" BOOLEAN NOT NULL DEFAULT false,
    "aracKontrolBypassAyari" BOOLEAN NOT NULL DEFAULT false,
    "sonKontrol" BOOLEAN NOT NULL DEFAULT false,
    "tipOnay" BOOLEAN NOT NULL DEFAULT false,
    "fatura" BOOLEAN NOT NULL DEFAULT false,
    "akmTseMuayenesi" TEXT NOT NULL DEFAULT 'YOK',
    "dmoMuayenesi" TEXT NOT NULL DEFAULT 'MUAYENE YOK',
    "tahsilat" BOOLEAN NOT NULL DEFAULT false,
    "teslimat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "sasiNo" TEXT,
    "silindir" TEXT,
    "malzemeCinsi" TEXT,

    CONSTRAINT "Dorse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sasi" (
    "id" SERIAL NOT NULL,
    "imalatNo" INTEGER,
    "musteri" TEXT NOT NULL,
    "sasiNo" TEXT,
    "tampon" TEXT,
    "dingil" TEXT,
    "plazmaProgrami" BOOLEAN NOT NULL DEFAULT false,
    "sacMalzemeKontrolu" BOOLEAN NOT NULL DEFAULT false,
    "plazmaKesim" BOOLEAN NOT NULL DEFAULT false,
    "presBukum" BOOLEAN NOT NULL DEFAULT false,
    "lenjorenMontaji" BOOLEAN NOT NULL DEFAULT false,
    "robotKaynagi" BOOLEAN NOT NULL DEFAULT false,
    "saseFiksturCatim" BOOLEAN NOT NULL DEFAULT false,
    "kaynak" BOOLEAN NOT NULL DEFAULT false,
    "dingilMontaji" BOOLEAN NOT NULL DEFAULT false,
    "genelKaynak" BOOLEAN NOT NULL DEFAULT false,
    "tesisatCubugu" BOOLEAN NOT NULL DEFAULT false,
    "mekanikAyak" BOOLEAN NOT NULL DEFAULT false,
    "korukMontaji" BOOLEAN NOT NULL DEFAULT false,
    "lastikMontaji" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adet" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Sasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
