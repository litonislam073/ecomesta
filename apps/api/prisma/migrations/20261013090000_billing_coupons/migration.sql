-- Super Admin coupons for plan payments.
CREATE TYPE "BillingCouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TABLE "billing_coupons" (
    "id" UUID NOT NULL,
    "code" CITEXT NOT NULL,
    "description" TEXT,
    "type" "BillingCouponType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "plan_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billing_cycles" "BillingCycle"[] DEFAULT ARRAY[]::"BillingCycle"[],
    "max_redemptions" INTEGER,
    "max_per_tenant" INTEGER DEFAULT 1,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_coupons_code_key" ON "billing_coupons"("code");
CREATE INDEX "billing_coupons_active_idx" ON "billing_coupons"("active");

-- Payments remember the coupon, the list price and the discount.
ALTER TABLE "billing_payments"
    ADD COLUMN "coupon_id" UUID,
    ADD COLUMN "coupon_code" TEXT,
    ADD COLUMN "list_amount" DECIMAL(12,2),
    ADD COLUMN "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE INDEX "billing_payments_coupon_id_idx" ON "billing_payments"("coupon_id");

ALTER TABLE "billing_payments"
    ADD CONSTRAINT "billing_payments_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "billing_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
