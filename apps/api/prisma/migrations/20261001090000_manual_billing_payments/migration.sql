-- Manual subscription payments (bKash / Nagad / Rocket / Upay) reviewed by a
-- Super Admin, and the Starter / Growth / Business plans with per-plan limits.
-- Additive: one new table and two enums; plan rows are upserted by slug.

-- CreateEnum
CREATE TYPE "ManualPaymentMethod" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'UPAY');

-- CreateEnum
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "subscription_id" UUID,
    "billing_cycle" "BillingCycle" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "method" "ManualPaymentMethod" NOT NULL,
    "pay_to_number" TEXT NOT NULL,
    "sender_number" TEXT NOT NULL,
    "transaction_id" CITEXT NOT NULL,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_by_user_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_payments_status_created_at_idx" ON "billing_payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "billing_payments_tenant_id_created_at_idx" ON "billing_payments"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_method_transaction_id_key" ON "billing_payments"("method", "transaction_id");

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A business has at most one payment waiting for review at a time.
CREATE UNIQUE INDEX "billing_payments_one_pending_per_tenant"
  ON "billing_payments"("tenant_id") WHERE "status" = 'PENDING';

-- Plans. 6-month and yearly prices are derived in code (10% / 25% off);
-- yearly_price is stored for reference: monthly x 12 x 0.75.
INSERT INTO "subscription_plans" ("id", "name", "slug", "description", "monthly_price", "yearly_price", "active", "configuration", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Starter', 'starter', 'For new online businesses', 99.00, 891.00, true,
   '{"trialMonths": 2, "tagline": "For new online businesses", "highlighted": false, "sortOrder": 1,
     "features": ["Online store on your own Ecomesta web address", "Up to 50 products with variants and categories", "Orders, customers and inventory in one dashboard", "Cash on Delivery checkout", "Default storefront theme"],
     "limits": {"maxProducts": 50, "customDomain": false, "onlinePayments": false, "stripe": false, "coupons": false, "deliveryZones": false, "allThemes": false}}'::jsonb,
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Growth', 'growth', 'For growing online businesses', 299.00, 2691.00, true,
   '{"trialMonths": 2, "tagline": "For growing online businesses", "highlighted": true, "sortOrder": 2,
     "features": ["Everything in Starter", "Up to 500 products", "Connect your own domain", "Online payments with SSLCommerz (bKash, Nagad, cards)", "Discount coupons and Bangladesh delivery zones", "All storefront themes"],
     "limits": {"maxProducts": 500, "customDomain": true, "onlinePayments": true, "stripe": false, "coupons": true, "deliveryZones": true, "allThemes": true}}'::jsonb,
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Business', 'business', 'For established online businesses', 699.00, 6291.00, true,
   '{"trialMonths": 2, "tagline": "For established online businesses", "highlighted": false, "sortOrder": 3,
     "features": ["Everything in Growth", "Unlimited products", "Stripe for international card payments", "Priority support"],
     "limits": {"maxProducts": null, "customDomain": true, "onlinePayments": true, "stripe": true, "coupons": true, "deliveryZones": true, "allThemes": true}}'::jsonb,
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "monthly_price" = EXCLUDED."monthly_price",
  "yearly_price" = EXCLUDED."yearly_price",
  "active" = true,
  "configuration" = EXCLUDED."configuration",
  "updated_at" = CURRENT_TIMESTAMP;
