-- Phase 14: per-customer coupon limit + order coupon code snapshot
ALTER TABLE "coupons" ADD COLUMN "per_customer_limit" INTEGER;
ALTER TABLE "orders" ADD COLUMN "coupon_code" CITEXT;
