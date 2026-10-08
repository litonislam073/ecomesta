-- Courier integration V1 (Steadfast first). Additive only: new nullable columns
-- on "shipments" and two new tables; no existing row is modified.
-- Rollback SQL: docs/couriers.md ("Rolling back the migration").

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "cod_amount" DECIMAL(12,2),
ADD COLUMN     "last_synced_at" TIMESTAMP(3),
ADD COLUMN     "provider_reference" TEXT,
ADD COLUMN     "provider_shipment_id" TEXT,
ADD COLUMN     "provider_status" TEXT,
ADD COLUMN     "weight_kg" DECIMAL(8,3);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "provider_status" TEXT,
    "status" "ShipmentStatus",
    "message" VARCHAR(500),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_connections" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "provider" "ShippingProvider" NOT NULL,
    "encrypted_credentials" TEXT NOT NULL,
    "public_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_events_shipment_id_occurred_at_idx" ON "shipment_events"("shipment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "shipment_events_store_id_idx" ON "shipment_events"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_connections_store_id_provider_key" ON "courier_connections"("store_id", "provider");

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_connections" ADD CONSTRAINT "courier_connections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One active courier booking per order. The row is written before the courier
-- is called (provider_reference set), so concurrent "Create shipment" requests
-- cannot both book; cancelled/returned/failed bookings free the order again.
CREATE UNIQUE INDEX "shipments_one_active_courier_booking_per_order"
  ON "shipments"("order_id")
  WHERE "provider_reference" IS NOT NULL
    AND "status" NOT IN ('CANCELLED', 'RETURNED', 'FAILED');

-- A courier's parcel id and the reference we sent it identify one shipment.
CREATE UNIQUE INDEX "shipments_provider_shipment_id_key"
  ON "shipments"("provider", "provider_shipment_id")
  WHERE "provider_shipment_id" IS NOT NULL;

CREATE UNIQUE INDEX "shipments_provider_reference_key"
  ON "shipments"("provider", "provider_reference")
  WHERE "provider_reference" IS NOT NULL;
