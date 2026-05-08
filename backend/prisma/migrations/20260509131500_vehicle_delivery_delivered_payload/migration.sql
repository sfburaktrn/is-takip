ALTER TABLE "vehicle_delivery_event" ADD COLUMN IF NOT EXISTS "delivered_payload_json" JSONB;
