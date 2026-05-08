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
    `ALTER TABLE "Damper" ADD COLUMN IF NOT EXISTS "cardNote" TEXT`,
    `ALTER TABLE "Dorse" ADD COLUMN IF NOT EXISTS "cardNote" TEXT`,
    `ALTER TABLE "Dorse" ADD COLUMN IF NOT EXISTS "frenMarka" TEXT`,
    `ALTER TABLE "Sasi" ADD COLUMN IF NOT EXISTS "cardNote" TEXT`,

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

    `CREATE TABLE IF NOT EXISTS "proposal_ingest" (
    "id" SERIAL NOT NULL,
    "source_proposal_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "proposal_date" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "equipment" TEXT,
    "vehicle" TEXT,
    "volume" TEXT,
    "thickness" TEXT,
    "delivery_date" TIMESTAMP(3),
    "contact_person" TEXT,
    "notes" TEXT,
    "owner_email" TEXT,
    "pushed_at" TIMESTAMP(3) NOT NULL,
    "pushed_by" TEXT,
    "approval_logged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proposal_ingest_pkey" PRIMARY KEY ("id")
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "proposal_ingest_source_proposal_id_key" ON "proposal_ingest"("source_proposal_id")`,
    `CREATE INDEX IF NOT EXISTS "proposal_ingest_pushed_at_idx" ON "proposal_ingest"("pushed_at" DESC)`,
    `ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "imalata_alindi" BOOLEAN NOT NULL DEFAULT false`,
    `CREATE INDEX IF NOT EXISTS "proposal_ingest_imalata_alindi_idx" ON "proposal_ingest"("imalata_alindi")`,
    `ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "teknik_pdf_url" TEXT`,
    `ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "manufacturing_not" TEXT`,
    `ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "manufacturing_aciliyet" TEXT`,
    `ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "planning_product_type" TEXT`,
    `ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "expected_delivery_days" INTEGER`,
    `ALTER TABLE "proposal_ingest" ADD COLUMN IF NOT EXISTS "target_delivery_date" TIMESTAMP(3)`,
    `CREATE INDEX IF NOT EXISTS "proposal_ingest_approval_logged_at_idx" ON "proposal_ingest"("approval_logged_at")`,

    `CREATE TABLE IF NOT EXISTS "proposal_plan_segment" (
    "id" SERIAL NOT NULL,
    "proposal_ingest_id" INTEGER NOT NULL,
    "main_step_key" TEXT NOT NULL,
    "planned_start" TIMESTAMP(3) NOT NULL,
    "planned_end" TIMESTAMP(3) NOT NULL,
    "duration_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proposal_plan_segment_pkey" PRIMARY KEY ("id")
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "proposal_plan_segment_proposal_ingest_id_main_step_key_key" ON "proposal_plan_segment"("proposal_ingest_id", "main_step_key")`,
    `CREATE INDEX IF NOT EXISTS "proposal_plan_segment_proposal_ingest_id_idx" ON "proposal_plan_segment"("proposal_ingest_id")`,
    `DO $ensurePlanSeg$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposal_plan_segment_proposal_ingest_id_fkey') THEN
            ALTER TABLE "proposal_plan_segment" ADD CONSTRAINT "proposal_plan_segment_proposal_ingest_id_fkey"
            FOREIGN KEY ("proposal_ingest_id") REFERENCES "proposal_ingest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END $ensurePlanSeg$`,
    `ALTER TABLE "proposal_plan_segment" ADD COLUMN IF NOT EXISTS "unit_index" INTEGER NOT NULL DEFAULT 1`,
    `DROP INDEX IF EXISTS "proposal_plan_segment_proposal_ingest_id_main_step_key_key"`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "proposal_plan_segment_proposal_ingest_id_unit_index_main_step_key_key" ON "proposal_plan_segment"("proposal_ingest_id", "unit_index", "main_step_key")`,

    `CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NEW_PRODUCT',
    "productType" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
)`,
    `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'NEW_PRODUCT'`,
    `CREATE TABLE IF NOT EXISTS "NotificationRead" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
)`,
    `CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Notification_productType_productId_idx" ON "Notification"("productType", "productId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRead_userId_notificationId_key" ON "NotificationRead"("userId", "notificationId")`,
    `CREATE INDEX IF NOT EXISTS "NotificationRead_userId_idx" ON "NotificationRead"("userId")`,
    `DO $ensureNotifActor$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_actorUserId_fkey') THEN
            ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorUserId_fkey"
            FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END $ensureNotifActor$`,
    `DO $ensureNotifReadUser$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationRead_userId_fkey') THEN
            ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END $ensureNotifReadUser$`,
    `DO $ensureNotifReadNotif$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationRead_notificationId_fkey') THEN
            ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey"
            FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END $ensureNotifReadNotif$`,

    `CREATE TABLE IF NOT EXISTS "vehicle_delivery_event" (
    "id" SERIAL NOT NULL,
    "source_delivery_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "payload_json" JSONB,
    "arrived_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_delivery_event_pkey" PRIMARY KEY ("id")
)`,
    `ALTER TABLE "vehicle_delivery_event" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `DO $vdeme$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'vehicle_delivery_event'
          AND column_name = 'event_type'
      ) THEN
        WITH agg AS (
          SELECT
            source_delivery_id,
            MIN(id) AS keep_id,
            MAX(arrived_at) FILTER (WHERE event_type = 'VEHICLE_INBOUND') AS arr_at,
            MAX(delivered_at) FILTER (WHERE event_type = 'VEHICLE_DELIVERED') AS del_at,
            COALESCE(
              MAX(payload_json) FILTER (WHERE event_type = 'VEHICLE_INBOUND'),
              MAX(payload_json) FILTER (WHERE event_type = 'VEHICLE_DELIVERED')
            ) AS merged_pj,
            COALESCE(
              MAX(company_name) FILTER (WHERE event_type = 'VEHICLE_INBOUND'),
              MAX(company_name) FILTER (WHERE event_type = 'VEHICLE_DELIVERED')
            ) AS merged_cn
          FROM "vehicle_delivery_event"
          GROUP BY source_delivery_id
        )
        UPDATE "vehicle_delivery_event" v
        SET
          arrived_at = agg.arr_at,
          delivered_at = agg.del_at,
          company_name = agg.merged_cn,
          payload_json = agg.merged_pj,
          updated_at = CURRENT_TIMESTAMP
        FROM agg
        WHERE v.source_delivery_id = agg.source_delivery_id AND v.id = agg.keep_id;

        DELETE FROM "vehicle_delivery_event" v
        WHERE v.id NOT IN (
          SELECT MIN(id) FROM "vehicle_delivery_event" GROUP BY source_delivery_id
        );

        DROP INDEX IF EXISTS "vehicle_delivery_event_event_type_source_delivery_id_key";
        ALTER TABLE "vehicle_delivery_event" DROP COLUMN "event_type";
      END IF;
    END $vdeme$`,
    `ALTER TABLE "vehicle_delivery_event" DROP COLUMN IF EXISTS "event_type"`,
    `DROP INDEX IF EXISTS "vehicle_delivery_event_event_type_source_delivery_id_key"`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_delivery_event_source_delivery_id_key"
    ON "vehicle_delivery_event"("source_delivery_id")`,
    `CREATE INDEX IF NOT EXISTS "vehicle_delivery_event_company_name_idx" ON "vehicle_delivery_event"("company_name")`,
    `CREATE INDEX IF NOT EXISTS "vehicle_delivery_event_created_at_idx" ON "vehicle_delivery_event"("created_at" DESC)`,
    `ALTER TABLE "vehicle_delivery_event" ADD COLUMN IF NOT EXISTS "delivered_payload_json" JSONB`,
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
