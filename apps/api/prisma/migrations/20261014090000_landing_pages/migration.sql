-- Landing pages: one-page campaign sites with their own order form, built
-- from a template (Growth and Business plans). Orders remember the landing
-- page they came from. Additive.

-- CreateEnum
CREATE TYPE "LandingPageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "landing_page_id" UUID;

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "template" VARCHAR(40) NOT NULL,
    "status" "LandingPageStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "published_content" JSONB,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_pages_store_id_updated_at_idx" ON "landing_pages"("store_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_store_id_slug_key" ON "landing_pages"("store_id", "slug");

-- CreateIndex
CREATE INDEX "orders_landing_page_id_idx" ON "orders"("landing_page_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Plan limits (keep in sync with apps/api/src/modules/billing/plan-defaults.ts):
-- Starter: no landing pages · Growth: up to 5 · Business: unlimited.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      jsonb_set("configuration", '{limits,landingPages}', 'false'::jsonb, true),
      '{limits,maxLandingPages}', '0'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter' AND "configuration" ? 'limits';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      jsonb_set("configuration", '{limits,landingPages}', 'true'::jsonb, true),
      '{limits,maxLandingPages}', '5'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'growth' AND "configuration" ? 'limits';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      jsonb_set("configuration", '{limits,landingPages}', 'true'::jsonb, true),
      '{limits,maxLandingPages}', 'null'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'business' AND "configuration" ? 'limits';

-- The plans' feature lists (shown on pricing and billing pages).
UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{features}',
      COALESCE("configuration"->'features', '[]'::jsonb) || '["Up to 5 landing pages with their own order form"]'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'growth' AND "configuration" ? 'limits'
  AND NOT (COALESCE("configuration"->'features', '[]'::jsonb) ? 'Up to 5 landing pages with their own order form');

UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{features}',
      COALESCE("configuration"->'features', '[]'::jsonb) || '["Unlimited landing pages"]'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'business' AND "configuration" ? 'limits'
  AND NOT (COALESCE("configuration"->'features', '[]'::jsonb) ? 'Unlimited landing pages');
