-- Marketing & tracking (Facebook Pixel, Google Tag Manager, Google Analytics,
-- Search Console) is included in Growth and Business. Keep in sync with plan-defaults.ts.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{limits,marketingTracking}', 'false'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter' AND "configuration" ? 'limits';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{limits,marketingTracking}', 'true'::jsonb, true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" IN ('growth', 'business') AND "configuration" ? 'limits';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      "configuration",
      '{features}',
      COALESCE("configuration"->'features', '[]'::jsonb) || '["Facebook Pixel, Google Analytics & Tag Manager"]'::jsonb,
      true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'growth' AND "configuration" ? 'limits'
  AND NOT COALESCE("configuration"->'features', '[]'::jsonb) ? 'Facebook Pixel, Google Analytics & Tag Manager';
