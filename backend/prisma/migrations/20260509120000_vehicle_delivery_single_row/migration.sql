-- Tek satır / sourceDeliveryId: önce eski (event_type + satır) verisini birleştir, sonra şemayı sadeleştir.

ALTER TABLE "vehicle_delivery_event" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
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
END $$;

DROP INDEX IF EXISTS "vehicle_delivery_event_event_type_source_delivery_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_delivery_event_source_delivery_id_key"
  ON "vehicle_delivery_event"("source_delivery_id");
