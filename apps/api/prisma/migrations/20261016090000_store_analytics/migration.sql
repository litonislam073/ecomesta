-- CreateEnum
CREATE TYPE "StoreAnalyticsEventType" AS ENUM ('PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_START');

-- CreateEnum
CREATE TYPE "AnalyticsDevice" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP');

-- CreateTable
CREATE TABLE "store_analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "store_id" UUID NOT NULL,
    "type" "StoreAnalyticsEventType" NOT NULL,
    "visitor_hash" CHAR(16) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "product_id" UUID,
    "source" VARCHAR(80) NOT NULL,
    "device" "AnalyticsDevice" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_analytics_events_store_id_created_at_idx" ON "store_analytics_events"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "store_analytics_events_store_id_type_created_at_idx" ON "store_analytics_events"("store_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "store_analytics_events" ADD CONSTRAINT "store_analytics_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Plan limits (keep in sync with apps/api/src/modules/billing/plan-defaults.ts):
-- Starter: 30-day sales overview only · Growth and Business: full sales and visitor analytics.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{limits,advancedAnalytics}', 'false'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter' AND "configuration" ? 'limits';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{limits,advancedAnalytics}', 'true'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" IN ('growth', 'business') AND "configuration" ? 'limits';

-- The plans' feature lists (shown on pricing and billing pages).
UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{features}',
      COALESCE("configuration"->'features', '[]'::jsonb) || '["Sales overview for the last 30 days"]'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter' AND "configuration" ? 'limits'
  AND NOT (COALESCE("configuration"->'features', '[]'::jsonb) ? 'Sales overview for the last 30 days');

UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{features}',
      COALESCE("configuration"->'features', '[]'::jsonb) || '["Full sales and visitor analytics"]'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'growth' AND "configuration" ? 'limits'
  AND NOT (COALESCE("configuration"->'features', '[]'::jsonb) ? 'Full sales and visitor analytics');
