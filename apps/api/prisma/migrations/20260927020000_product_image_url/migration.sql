-- Primary product image (nullable; existing products are unaffected).
ALTER TABLE "products" ADD COLUMN "image_url" TEXT;

-- Attach bundled sample images to demo products imported before this column existed.
UPDATE "products" p
SET "image_url" = '/demo-catalog/' || v.file || '.jpg'
FROM (VALUES
  ('SAMPLE-HEADPHONES', 'wireless-headphones'),
  ('SAMPLE-SMARTWATCH', 'smart-watch'),
  ('SAMPLE-TSHIRT', 'cotton-t-shirt'),
  ('SAMPLE-SNEAKERS', 'casual-sneakers'),
  ('SAMPLE-BACKPACK', 'premium-backpack'),
  ('SAMPLE-MUG', 'ceramic-coffee-mug'),
  ('SAMPLE-DESKLAMP', 'led-desk-lamp'),
  ('SAMPLE-SKINCARE', 'skincare-gift-set'),
  ('SAMPLE-HONEY', 'pure-honey-500g')
) AS v(sku, file)
WHERE p."is_demo" = true
  AND p."sku" = v.sku
  AND p."image_url" IS NULL;
