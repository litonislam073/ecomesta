-- Phase 20: Bangladesh locations, shipping zones, method extensions, address snapshots.

-- Global Bangladesh hierarchy
CREATE TABLE "bd_divisions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bd_divisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bd_divisions_code_key" ON "bd_divisions"("code");
CREATE INDEX "bd_divisions_active_idx" ON "bd_divisions"("active");

CREATE TABLE "bd_districts" (
    "id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bd_districts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bd_districts_division_id_code_key" ON "bd_districts"("division_id", "code");
CREATE UNIQUE INDEX "bd_districts_code_key" ON "bd_districts"("code");
CREATE INDEX "bd_districts_division_id_idx" ON "bd_districts"("division_id");
CREATE INDEX "bd_districts_active_idx" ON "bd_districts"("active");

CREATE TABLE "bd_upazilas" (
    "id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bd_upazilas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bd_upazilas_district_id_code_key" ON "bd_upazilas"("district_id", "code");
CREATE UNIQUE INDEX "bd_upazilas_code_key" ON "bd_upazilas"("code");
CREATE INDEX "bd_upazilas_district_id_idx" ON "bd_upazilas"("district_id");
CREATE INDEX "bd_upazilas_active_idx" ON "bd_upazilas"("active");

ALTER TABLE "bd_districts" ADD CONSTRAINT "bd_districts_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "bd_divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd_upazilas" ADD CONSTRAINT "bd_upazilas_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "bd_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shipping zones
CREATE TABLE "shipping_zones" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shipping_zones_store_id_idx" ON "shipping_zones"("store_id");
CREATE INDEX "shipping_zones_store_id_active_idx" ON "shipping_zones"("store_id", "active");
CREATE INDEX "shipping_zones_store_id_priority_idx" ON "shipping_zones"("store_id", "priority");

ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipping_zone_locations" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "division_id" UUID,
    "district_id" UUID,
    "upazila_id" UUID,

    CONSTRAINT "shipping_zone_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shipping_zone_locations_zone_id_idx" ON "shipping_zone_locations"("zone_id");
CREATE INDEX "shipping_zone_locations_store_id_idx" ON "shipping_zone_locations"("store_id");
CREATE INDEX "shipping_zone_locations_division_id_idx" ON "shipping_zone_locations"("division_id");
CREATE INDEX "shipping_zone_locations_district_id_idx" ON "shipping_zone_locations"("district_id");
CREATE INDEX "shipping_zone_locations_upazila_id_idx" ON "shipping_zone_locations"("upazila_id");

ALTER TABLE "shipping_zone_locations" ADD CONSTRAINT "shipping_zone_locations_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipping_zone_locations" ADD CONSTRAINT "shipping_zone_locations_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "bd_divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipping_zone_locations" ADD CONSTRAINT "shipping_zone_locations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "bd_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipping_zone_locations" ADD CONSTRAINT "shipping_zone_locations_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "bd_upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extend shipping methods
ALTER TABLE "shipping_methods"
ADD COLUMN "zone_id" UUID,
ADD COLUMN "free_shipping_threshold" DECIMAL(12,2),
ADD COLUMN "cod_allowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "estimated_delivery" TEXT,
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "shipping_methods_store_id_zone_id_idx" ON "shipping_methods"("store_id", "zone_id");
CREATE INDEX "shipping_methods_zone_id_idx" ON "shipping_methods"("zone_id");

ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "shipping_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Order / address snapshots
ALTER TABLE "orders" ADD COLUMN "shipping_zone_name" TEXT;

ALTER TABLE "customer_addresses"
ADD COLUMN "division_id" UUID,
ADD COLUMN "district_id" UUID,
ADD COLUMN "upazila_id" UUID,
ADD COLUMN "landmark" TEXT;

CREATE INDEX "customer_addresses_division_id_idx" ON "customer_addresses"("division_id");
CREATE INDEX "customer_addresses_district_id_idx" ON "customer_addresses"("district_id");
CREATE INDEX "customer_addresses_upazila_id_idx" ON "customer_addresses"("upazila_id");

ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "bd_divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "bd_districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "bd_upazilas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_addresses"
ADD COLUMN "division_id" UUID,
ADD COLUMN "district_id" UUID,
ADD COLUMN "upazila_id" UUID,
ADD COLUMN "division_name" TEXT,
ADD COLUMN "district_name" TEXT,
ADD COLUMN "upazila_name" TEXT,
ADD COLUMN "landmark" TEXT;
