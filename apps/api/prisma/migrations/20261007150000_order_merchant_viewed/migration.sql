-- New-order badge: when the store's team first opened an order.
-- Additive: one nullable column and a partial index.

ALTER TABLE "orders" ADD COLUMN "merchant_viewed_at" TIMESTAMP(3);

-- Orders placed before this release count as already seen, so no store starts
-- with a badge of its whole order history.
UPDATE "orders" SET "merchant_viewed_at" = "created_at" WHERE "merchant_viewed_at" IS NULL;

-- Counting a store's unseen orders stays cheap however many orders it has.
CREATE INDEX "orders_store_id_unviewed_idx" ON "orders"("store_id")
  WHERE "merchant_viewed_at" IS NULL AND "status" <> 'DRAFT';
