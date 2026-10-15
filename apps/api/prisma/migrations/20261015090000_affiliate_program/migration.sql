-- Ecomesta's affiliate program: applications approved by a Super Admin,
-- referrals from ?ref= links, a commission on each referred business's first
-- plan payment, and manual payouts. Plus a small platform settings table.
-- Additive.

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "affiliates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "application_note" VARCHAR(1000),
    "commission_rate" DECIMAL(5,2),
    "payout_method" "ManualPaymentMethod",
    "payout_number" VARCHAR(20),
    "payout_name" VARCHAR(100),
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "status_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_referrals" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commissions" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "billing_payment_id" UUID NOT NULL,
    "payment_amount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'APPROVED',
    "available_at" TIMESTAMP(3) NOT NULL,
    "rejection_reason" VARCHAR(500),
    "reviewed_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payouts" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "ManualPaymentMethod" NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "account_name" VARCHAR(100),
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "transaction_id" VARCHAR(40),
    "rejection_reason" VARCHAR(500),
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_user_id_key" ON "affiliates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");

-- CreateIndex
CREATE INDEX "affiliates_status_created_at_idx" ON "affiliates"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_referrals_user_id_key" ON "affiliate_referrals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_referrals_tenant_id_key" ON "affiliate_referrals"("tenant_id");

-- CreateIndex
CREATE INDEX "affiliate_referrals_affiliate_id_created_at_idx" ON "affiliate_referrals"("affiliate_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commissions_tenant_id_key" ON "affiliate_commissions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commissions_billing_payment_id_key" ON "affiliate_commissions"("billing_payment_id");

-- CreateIndex
CREATE INDEX "affiliate_commissions_affiliate_id_created_at_idx" ON "affiliate_commissions"("affiliate_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_payouts_affiliate_id_created_at_idx" ON "affiliate_payouts"("affiliate_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_payouts_status_created_at_idx" ON "affiliate_payouts"("status", "created_at");

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_billing_payment_id_fkey" FOREIGN KEY ("billing_payment_id") REFERENCES "billing_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One open withdrawal request per affiliate.
CREATE UNIQUE INDEX "affiliate_payouts_one_requested_per_affiliate"
  ON "affiliate_payouts"("affiliate_id") WHERE "status" = 'REQUESTED';

-- Program defaults (Super Admins can change them): 20% commission, 30-day
-- referral cookie, 7-day hold before a commission can be withdrawn, ৳500 minimum payout.
INSERT INTO "platform_settings" ("key", "value", "updated_at")
VALUES ('affiliate', '{"enabled": true, "commissionRate": 20, "cookieDays": 30, "holdDays": 7, "minPayout": 500}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
