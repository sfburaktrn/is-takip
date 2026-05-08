-- Teklif Takip → araç giriş / teslim ingest
CREATE TABLE "vehicle_delivery_event" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "source_delivery_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "payload_json" JSONB,
    "arrived_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_delivery_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_delivery_event_event_type_source_delivery_id_key" ON "vehicle_delivery_event"("event_type", "source_delivery_id");
CREATE INDEX "vehicle_delivery_event_company_name_idx" ON "vehicle_delivery_event"("company_name");
CREATE INDEX "vehicle_delivery_event_created_at_idx" ON "vehicle_delivery_event"("created_at" DESC);
