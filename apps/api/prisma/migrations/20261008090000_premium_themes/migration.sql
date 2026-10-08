-- Premium themes: a price on the theme, purchases by mobile wallet, and the
-- Business plan including premium themes. Additive.

ALTER TABLE "themes" ADD COLUMN "price_bdt" DECIMAL(12,2);

CREATE TABLE "theme_purchases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "theme_id" UUID NOT NULL,
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

    CONSTRAINT "theme_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "theme_purchases_method_transaction_id_key" ON "theme_purchases"("method", "transaction_id");
CREATE INDEX "theme_purchases_tenant_id_idx" ON "theme_purchases"("tenant_id");
CREATE INDEX "theme_purchases_status_created_at_idx" ON "theme_purchases"("status", "created_at");

-- One purchase waiting for review, and at most one approved, per business and theme.
CREATE UNIQUE INDEX "theme_purchases_one_pending_per_tenant_theme"
  ON "theme_purchases"("tenant_id", "theme_id") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "theme_purchases_one_approved_per_tenant_theme"
  ON "theme_purchases"("tenant_id", "theme_id") WHERE "status" = 'APPROVED';

ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business includes premium themes (Starter and Growth buy them). Keep in sync with plan-defaults.ts.
UPDATE "subscription_plans"
SET "configuration" = jsonb_set(
      jsonb_set("configuration", '{limits,premiumThemes}', 'true'::jsonb, true),
      '{features}',
      COALESCE("configuration"->'features', '[]'::jsonb) || '["Premium themes included"]'::jsonb,
      true),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'business' AND "configuration" ? 'limits'
  AND NOT COALESCE("configuration"->'features', '[]'::jsonb) ? 'Premium themes included';
