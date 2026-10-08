-- Plan limits: product counts and image storage per plan. Data only — no
-- schema change. Other configuration (prices, trial, flags) is left as it is.
-- Keep in sync with apps/api/src/modules/billing/plan-defaults.ts.
--
-- Starter: 25 products, 1 GB · Growth: 100 products, 3 GB · Business: unlimited products, 5 GB.
-- Existing products are never removed: a business above its new product or
-- storage limit keeps everything and cannot add more until it is under the
-- limit again (or upgrades).

UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE("configuration", '{}'::jsonb), '{limits,maxProducts}', '25'::jsonb, true),
        '{limits,storageMb}', '1024'::jsonb, true),
      '{features}',
      '["Online store on your own Ecomesta web address", "Up to 25 products with variants and categories", "1 GB storage", "Orders, customers and inventory in one dashboard", "Cash on Delivery checkout", "Default storefront theme"]'::jsonb,
      true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter' AND "configuration" ? 'limits';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE("configuration", '{}'::jsonb), '{limits,maxProducts}', '100'::jsonb, true),
        '{limits,storageMb}', '3072'::jsonb, true),
      '{features}',
      '["Everything in Starter", "Up to 100 products", "3 GB storage", "Connect your own domain", "Online payments with SSLCommerz (bKash, Nagad, cards)", "Discount coupons and Bangladesh delivery zones", "All storefront themes"]'::jsonb,
      true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'growth' AND "configuration" ? 'limits';

UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE("configuration", '{}'::jsonb), '{limits,maxProducts}', 'null'::jsonb, true),
        '{limits,storageMb}', '5120'::jsonb, true),
      '{features}',
      '["Everything in Growth", "Unlimited products", "5 GB storage", "Stripe for international card payments", "Priority support"]'::jsonb,
      true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'business' AND "configuration" ? 'limits';
