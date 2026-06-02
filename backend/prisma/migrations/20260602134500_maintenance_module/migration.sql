-- Bakım modülü: Firma rehberi + teslimat sonrası 1 yıl bakım planı.
-- Yalnızca yeni tablolar ve güvenli backfill; mevcut ürün verilerine dokunulmaz.

CREATE TABLE IF NOT EXISTS "Company" (
    "id" SERIAL NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Company_normalizedKey_key" ON "Company"("normalizedKey");
CREATE INDEX IF NOT EXISTS "Company_displayName_idx" ON "Company"("displayName");

CREATE TABLE IF NOT EXISTS "MaintenanceSchedule" (
    "id" SERIAL NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 365,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "completedByUserId" INTEGER,
    "completionNote" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceSchedule_productType_productId_key"
ON "MaintenanceSchedule"("productType", "productId");

CREATE INDEX IF NOT EXISTS "MaintenanceSchedule_companyId_idx" ON "MaintenanceSchedule"("companyId");
CREATE INDEX IF NOT EXISTS "MaintenanceSchedule_dueAt_idx" ON "MaintenanceSchedule"("dueAt");
CREATE INDEX IF NOT EXISTS "MaintenanceSchedule_status_idx" ON "MaintenanceSchedule"("status");
CREATE INDEX IF NOT EXISTS "MaintenanceSchedule_productType_dueAt_idx" ON "MaintenanceSchedule"("productType", "dueAt");

DO $ensureMaintenanceCompanyFk$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceSchedule_companyId_fkey') THEN
        ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $ensureMaintenanceCompanyFk$;

DO $ensureMaintenanceCompletedByFk$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceSchedule_completedByUserId_fkey') THEN
        ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_completedByUserId_fkey"
        FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $ensureMaintenanceCompletedByFk$;

-- Backfill: teslim edilmiş ürünlerden firma ve bakım planı oluştur.
-- Not: normalizedKey SQL tarafında getBaseCompany mantığına yakın bir regex ile hesaplanır.
WITH delivered_products AS (
    SELECT
        'DAMPER'::TEXT AS "productType",
        d."id"::INTEGER AS "productId",
        d."musteri"::TEXT AS "musteri",
        d."teslimAt" AS "deliveredAt"
    FROM "Damper" d
    WHERE d."teslimat" = TRUE AND d."teslimAt" IS NOT NULL
    UNION ALL
    SELECT
        'DORSE'::TEXT AS "productType",
        r."id"::INTEGER AS "productId",
        r."musteri"::TEXT AS "musteri",
        r."teslimAt" AS "deliveredAt"
    FROM "Dorse" r
    WHERE r."teslimat" = TRUE AND r."teslimAt" IS NOT NULL
),
normalized AS (
    SELECT
        dp.*,
        trim(
            regexp_replace(
                regexp_replace(upper(trim(dp."musteri")), '\s*\d+\s*$', '', 'g'),
                '\s*[-_]\s*\d*\s*$',
                '',
                'g'
            )
        ) AS "normalizedKey"
    FROM delivered_products dp
    WHERE dp."musteri" IS NOT NULL AND length(trim(dp."musteri")) > 0
),
inserted_companies AS (
    INSERT INTO "Company" ("normalizedKey", "displayName", "createdAt", "updatedAt")
    SELECT DISTINCT
        n."normalizedKey",
        n."normalizedKey" AS "displayName",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM normalized n
    WHERE n."normalizedKey" IS NOT NULL AND length(trim(n."normalizedKey")) > 0
    ON CONFLICT ("normalizedKey") DO NOTHING
    RETURNING "id", "normalizedKey"
),
company_map AS (
    SELECT c."id", c."normalizedKey"
    FROM "Company" c
)
INSERT INTO "MaintenanceSchedule" (
    "productType",
    "productId",
    "companyId",
    "deliveredAt",
    "dueAt",
    "intervalDays",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    n."productType",
    n."productId",
    cm."id" AS "companyId",
    n."deliveredAt",
    (n."deliveredAt" + (365 * INTERVAL '1 day')) AS "dueAt",
    365 AS "intervalDays",
    CASE
        WHEN (n."deliveredAt" + (365 * INTERVAL '1 day')) < (CURRENT_DATE::timestamp) THEN 'OVERDUE'
        WHEN (n."deliveredAt" + (365 * INTERVAL '1 day')) <= ((CURRENT_DATE + 30)::timestamp) THEN 'DUE_SOON'
        ELSE 'SCHEDULED'
    END AS "status",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM normalized n
JOIN company_map cm ON cm."normalizedKey" = n."normalizedKey"
ON CONFLICT ("productType", "productId") DO NOTHING;

