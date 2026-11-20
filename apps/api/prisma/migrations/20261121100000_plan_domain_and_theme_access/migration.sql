-- Data only: custom domains on every plan, premium themes (ShopEase, Kenakata)
-- free on Growth as well as Business. Only plans with a `limits` object are
-- touched, and feature lines change only when they still read as shipped.

-- Starter: connect your own domain.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{limits,customDomain}', 'true'::jsonb)
WHERE "slug" = 'starter' AND jsonb_typeof("configuration"->'limits') = 'object';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{features}', ("configuration"->'features') || '["Connect your own domain"]'::jsonb)
WHERE "slug" = 'starter'
  AND jsonb_typeof("configuration"->'features') = 'array'
  AND NOT ("configuration"->'features') ? 'Connect your own domain';

-- Growth: premium themes included; the domain line now lives on Starter.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set("configuration", '{limits,premiumThemes}', 'true'::jsonb)
WHERE "slug" = 'growth' AND jsonb_typeof("configuration"->'limits') = 'object';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
  "configuration",
  '{features}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN f IN ('All storefront themes', 'All included themes (Default and Minimal)')
            THEN to_jsonb('All themes, including premium ShopEase and Kenakata'::text)
          ELSE to_jsonb(f)
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements_text("configuration"->'features') WITH ORDINALITY AS t(f, ord)
      WHERE f <> 'Connect your own domain'
    ),
    '[]'::jsonb
  )
)
WHERE "slug" = 'growth' AND jsonb_typeof("configuration"->'features') = 'array';

-- Business: premium themes are no longer a Business-only line.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
  "configuration",
  '{features}',
  COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(f) ORDER BY ord)
      FROM jsonb_array_elements_text("configuration"->'features') WITH ORDINALITY AS t(f, ord)
      WHERE f <> 'Premium themes included'
    ),
    '[]'::jsonb
  )
)
WHERE "slug" = 'business' AND jsonb_typeof("configuration"->'features') = 'array';
