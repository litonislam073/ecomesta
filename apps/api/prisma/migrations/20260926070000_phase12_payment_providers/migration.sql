-- Phase 12: payment provider configs, webhook idempotency, payment attempt refs.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'TEST';

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN "internal_reference" TEXT;
ALTER TABLE "payments" ADD COLUMN "attempt_number" INTEGER NOT NULL DEFAULT 1;

-- Backfill unique references for existing rows
UPDATE "payments"
SET "internal_reference" = 'pay_' || replace(id::text, '-', '')
WHERE "internal_reference" IS NULL;

ALTER TABLE "payments" ALTER COLUMN "internal_reference" SET NOT NULL;
CREATE UNIQUE INDEX "payments_internal_reference_key" ON "payments"("internal_reference");
CREATE INDEX "payments_order_id_attempt_number_idx" ON "payments"("order_id", "attempt_number");

-- CreateTable
CREATE TABLE "payment_provider_configs" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'test',
    "public_config" JSONB,
    "encrypted_secrets" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_configs_store_id_provider_key" ON "payment_provider_configs"("store_id", "provider");
CREATE INDEX "payment_provider_configs_store_id_enabled_idx" ON "payment_provider_configs"("store_id", "enabled");

ALTER TABLE "payment_provider_configs" ADD CONSTRAINT "payment_provider_configs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "store_id" UUID,
    "payment_id" UUID,
    "provider" "PaymentProvider" NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3),
    "summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider", "event_id");
CREATE INDEX "payment_webhook_events_payment_id_idx" ON "payment_webhook_events"("payment_id");
CREATE INDEX "payment_webhook_events_store_id_idx" ON "payment_webhook_events"("store_id");

ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
