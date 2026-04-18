-- Bildirim merkezi: yalnızca yeni tablolar; mevcut ürün / kullanıcı verilerine dokunulmaz.

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NEW_PRODUCT',
    "productType" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationRead" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX IF NOT EXISTS "Notification_productType_productId_idx" ON "Notification"("productType", "productId");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRead_userId_notificationId_key" ON "NotificationRead"("userId", "notificationId");
CREATE INDEX IF NOT EXISTS "NotificationRead_userId_idx" ON "NotificationRead"("userId");

DO $ensureNotifActor$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_actorUserId_fkey') THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $ensureNotifActor$;

DO $ensureNotifReadUser$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationRead_userId_fkey') THEN
        ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $ensureNotifReadUser$;

DO $ensureNotifReadNotif$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationRead_notificationId_fkey') THEN
        ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey"
        FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $ensureNotifReadNotif$;
