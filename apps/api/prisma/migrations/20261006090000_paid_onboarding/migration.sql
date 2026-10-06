-- Paid onboarding: no more free trial for new stores.
-- * New stores wait offline for their first subscription payment to be
--   approved (awaiting_first_payment), then go live.
-- * The Starter / Growth / Business plans no longer include free months.
--   Subscriptions already in their trial keep their existing trial_ends_at.

-- AlterTable
ALTER TABLE "stores" ADD COLUMN "awaiting_first_payment" BOOLEAN NOT NULL DEFAULT false;

-- No free months on the platform plans.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set(COALESCE("configuration", '{}'::jsonb), '{trialMonths}', '0'::jsonb),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" IN ('starter', 'growth', 'business');
