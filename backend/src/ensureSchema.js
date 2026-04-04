/**
 * Pooler / migration kayıt drift'i nedeniyle P2022 tekrarını önlemek için:
 * sunucu açılışında doğrudan PostgreSQL bağlantısıyla eksik tablo/sütunları
 * IF NOT EXISTS ile ekler. Var olan verilere dokunmaz.
 */
'use strict';

const { Client } = require('pg');

const STATEMENTS = [
    `ALTER TABLE "Damper" ADD COLUMN IF NOT EXISTS "productionStartedAt" TIMESTAMP(3)`,
    `ALTER TABLE "Dorse" ADD COLUMN IF NOT EXISTS "productionStartedAt" TIMESTAMP(3)`,
    `ALTER TABLE "Sasi" ADD COLUMN IF NOT EXISTS "productionStartedAt" TIMESTAMP(3)`,

    `CREATE TABLE IF NOT EXISTS "StepCompletionEvent" (
    "id" SERIAL NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "mainStepKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StepCompletionEvent_pkey" PRIMARY KEY ("id")
)`,
    `CREATE INDEX IF NOT EXISTS "StepCompletionEvent_productType_productId_mainStepKey_idx"
    ON "StepCompletionEvent"("productType", "productId", "mainStepKey")`,
    `CREATE INDEX IF NOT EXISTS "StepCompletionEvent_productType_completedAt_idx"
    ON "StepCompletionEvent"("productType", "completedAt")`,

    `CREATE TABLE IF NOT EXISTS "DepartmentWeekCapacity" (
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
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentWeekCapacity_productType_mainStepKey_weekStart_key"
    ON "DepartmentWeekCapacity"("productType", "mainStepKey", "weekStart")`,
    `CREATE INDEX IF NOT EXISTS "DepartmentWeekCapacity_productType_weekStart_idx"
    ON "DepartmentWeekCapacity"("productType", "weekStart")`,

    `CREATE TABLE IF NOT EXISTS "WeeklyStepTarget" (
    "id" SERIAL NOT NULL,
    "productType" TEXT NOT NULL,
    "mainStepKey" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyStepTarget_pkey" PRIMARY KEY ("id")
)`,
    `CREATE INDEX IF NOT EXISTS "WeeklyStepTarget_productType_weekStart_idx"
    ON "WeeklyStepTarget"("productType", "weekStart")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyStepTarget_productType_mainStepKey_weekStart_key"
    ON "WeeklyStepTarget"("productType", "mainStepKey", "weekStart")`,

    `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "summary" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
)`,
    `CREATE INDEX IF NOT EXISTS "AuditLog_productType_productId_idx" ON "AuditLog"("productType", "productId")`,
    `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,

    `DO $ensure$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
            ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END $ensure$`,
];

async function ensureDatabaseSchema() {
    const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL veya DIRECT_URL gerekli');
    }
    if (!process.env.DIRECT_URL) {
        console.warn('[ensureSchema] DIRECT_URL yok; DATABASE_URL kullanılıyor (Supabase pooler ile DDL bazen sorunlu olur).');
    }

    const client = new Client({ connectionString: url });
    await client.connect();
    try {
        for (const sql of STATEMENTS) {
            await client.query(sql);
        }
        console.log('[ensureSchema] Şema doğrulandı (eksik yapı varsa eklendi).');
    } finally {
        await client.end();
    }
}

module.exports = { ensureDatabaseSchema };
