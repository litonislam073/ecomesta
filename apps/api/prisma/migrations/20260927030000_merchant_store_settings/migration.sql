-- Merchant Settings: store contact details, checkout/order behaviour flags and
-- store-level SEO. Bangladesh-first defaults for newly created stores.

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "address" VARCHAR(500),
ADD COLUMN     "allow_customer_cancellation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "checkout_allow_order_notes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "checkout_require_phone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "og_description" VARCHAR(320),
ADD COLUMN     "og_image_url" VARCHAR(2048),
ADD COLUMN     "og_title" VARCHAR(120),
ADD COLUMN     "phone" VARCHAR(40),
ADD COLUMN     "seo_description" VARCHAR(320),
ADD COLUMN     "seo_indexing_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "seo_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seo_title" VARCHAR(120),
ALTER COLUMN "currency" SET DEFAULT 'BDT',
ALTER COLUMN "timezone" SET DEFAULT 'Asia/Dhaka',
ALTER COLUMN "locale" SET DEFAULT 'en-BD';

-- Backfill store SEO from the active theme's published SEO section so existing
-- storefront metadata is unchanged when SEO moves to Merchant Settings.
UPDATE "stores" AS s
SET
  "seo_title" = LEFT(NULLIF(BTRIM(st."published_configuration" -> 'seo' ->> 'title'), ''), 120),
  "seo_description" = LEFT(NULLIF(BTRIM(st."published_configuration" -> 'seo' ->> 'description'), ''), 320),
  "og_image_url" = CASE
    WHEN (st."published_configuration" -> 'seo' ->> 'ogImageUrl') ~* '^https?://'
      THEN LEFT(st."published_configuration" -> 'seo' ->> 'ogImageUrl', 2048)
    ELSE NULL
  END,
  "seo_keywords" = COALESCE(
    (
      SELECT ARRAY_AGG(LEFT(BTRIM(k), 60))
      FROM jsonb_array_elements_text(st."published_configuration" -> 'seo' -> 'keywords') AS k
      WHERE BTRIM(k) <> ''
    ),
    ARRAY[]::TEXT[]
  )
FROM "store_themes" AS st
WHERE st."store_id" = s."id"
  AND st."is_active" = true
  AND jsonb_typeof(st."published_configuration" -> 'seo') = 'object'
  AND (
    jsonb_typeof(st."published_configuration" -> 'seo' -> 'keywords') = 'array'
    OR st."published_configuration" -> 'seo' -> 'keywords' IS NULL
  );
