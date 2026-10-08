-- Marketing & tracking IDs a merchant sets for their storefront.
ALTER TABLE "stores"
  ADD COLUMN "meta_pixel_id" VARCHAR(20),
  ADD COLUMN "gtm_container_id" VARCHAR(20),
  ADD COLUMN "ga4_measurement_id" VARCHAR(20),
  ADD COLUMN "google_site_verification" VARCHAR(100);
