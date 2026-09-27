-- Phase 11: preserve shipping method snapshot on orders at purchase time.
ALTER TABLE "orders"
ADD COLUMN "shipping_method_name" TEXT,
ADD COLUMN "shipping_method_type" "ShippingMethodType";
