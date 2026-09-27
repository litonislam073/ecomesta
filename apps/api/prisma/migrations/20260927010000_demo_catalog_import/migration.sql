-- Optional demo catalog import: store-level one-time state + demo markers.

ALTER TABLE "stores" ADD COLUMN "demo_catalog_imported_at" TIMESTAMP(3);
ALTER TABLE "stores" ADD COLUMN "first_real_product_created_at" TIMESTAMP(3);

ALTER TABLE "products" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "categories" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- Existing stores that already have products count as having created a real
-- product, so the demo import CTA stays hidden for them.
UPDATE "stores" s
SET "first_real_product_created_at" = p.first_created
FROM (
  SELECT "store_id", MIN("created_at") AS first_created
  FROM "products"
  GROUP BY "store_id"
) p
WHERE p."store_id" = s."id"
  AND s."first_real_product_created_at" IS NULL;
