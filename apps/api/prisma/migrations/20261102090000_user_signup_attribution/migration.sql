-- First-touch signup attribution for merchant accounts (Admin Users source column).
-- Additive only: nullable columns and one index; existing rows stay NULL.

ALTER TABLE "users" ADD COLUMN "signup_channel" VARCHAR(32);
ALTER TABLE "users" ADD COLUMN "signup_utm_source" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "signup_utm_medium" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "signup_utm_campaign" VARCHAR(150);
ALTER TABLE "users" ADD COLUMN "signup_referrer_host" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "signup_landing_path" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "signup_affiliate_code" VARCHAR(32);

CREATE INDEX "users_signup_channel_idx" ON "users"("signup_channel");
