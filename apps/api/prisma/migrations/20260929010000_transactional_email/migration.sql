-- Transactional email: single-use hashed auth tokens and the email outbox/delivery log.
-- Additive only: new enums, new tables, no changes to existing rows.

CREATE TYPE "AuthTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "requested_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");
CREATE INDEX "auth_tokens_expires_at_idx" ON "auth_tokens"("expires_at");

ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "user_id" UUID,
    "tenant_id" UUID,
    "store_id" UUID,
    "recipient_hash" TEXT,
    "provider" TEXT,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_category" TEXT,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_deliveries_idempotency_key_key" ON "email_deliveries"("idempotency_key");
CREATE INDEX "email_deliveries_status_next_attempt_at_idx" ON "email_deliveries"("status", "next_attempt_at");
CREATE INDEX "email_deliveries_user_id_idx" ON "email_deliveries"("user_id");
CREATE INDEX "email_deliveries_tenant_id_idx" ON "email_deliveries"("tenant_id");
CREATE INDEX "email_deliveries_event_type_idx" ON "email_deliveries"("event_type");
CREATE INDEX "email_deliveries_created_at_idx" ON "email_deliveries"("created_at");

ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
