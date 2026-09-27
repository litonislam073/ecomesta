-- Phase 16: Storefront theming — published config snapshot on store themes
ALTER TABLE "store_themes" ADD COLUMN "published_configuration" JSONB;
ALTER TABLE "store_themes" ADD COLUMN "published_at" TIMESTAMP(3);
