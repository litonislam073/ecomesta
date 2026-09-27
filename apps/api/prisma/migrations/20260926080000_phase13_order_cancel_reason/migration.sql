-- Phase 13: optional customer-safe cancellation reason on orders
ALTER TABLE "orders" ADD COLUMN "cancel_reason" VARCHAR(500);
