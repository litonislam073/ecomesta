-- Domain sales: orders paid by mobile wallet and the domains registered for merchants.
-- Additive only: two new tables and their enums.

-- CreateEnum
CREATE TYPE "DomainOrderKind" AS ENUM ('REGISTER', 'RENEW');

-- CreateEnum
CREATE TYPE "DomainOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "domain_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID,
    "registered_domain_id" UUID,
    "kind" "DomainOrderKind" NOT NULL,
    "domain_name" CITEXT NOT NULL,
    "years" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cost_usd" DECIMAL(10,2) NOT NULL,
    "usd_rate" DECIMAL(10,2) NOT NULL,
    "margin_bdt" DECIMAL(12,2) NOT NULL,
    "method" "ManualPaymentMethod" NOT NULL,
    "pay_to_number" TEXT NOT NULL,
    "sender_number" TEXT NOT NULL,
    "transaction_id" CITEXT NOT NULL,
    "registrant" JSONB,
    "status" "DomainOrderStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "rejection_reason" TEXT,
    "submitted_by_user_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID,
    "name" CITEXT NOT NULL,
    "registrar" VARCHAR(32) NOT NULL DEFAULT 'dynadot',
    "registered_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_reminder_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registered_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_orders_tenant_id_idx" ON "domain_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "domain_orders_status_created_at_idx" ON "domain_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "domain_orders_domain_name_idx" ON "domain_orders"("domain_name");

-- CreateIndex
CREATE UNIQUE INDEX "domain_orders_method_transaction_id_key" ON "domain_orders"("method", "transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "registered_domains_name_key" ON "registered_domains"("name");

-- CreateIndex
CREATE INDEX "registered_domains_tenant_id_idx" ON "registered_domains"("tenant_id");

-- CreateIndex
CREATE INDEX "registered_domains_expires_at_idx" ON "registered_domains"("expires_at");

-- AddForeignKey
ALTER TABLE "domain_orders" ADD CONSTRAINT "domain_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_orders" ADD CONSTRAINT "domain_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_orders" ADD CONSTRAINT "domain_orders_registered_domain_id_fkey" FOREIGN KEY ("registered_domain_id") REFERENCES "registered_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_orders" ADD CONSTRAINT "domain_orders_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_orders" ADD CONSTRAINT "domain_orders_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_domains" ADD CONSTRAINT "registered_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_domains" ADD CONSTRAINT "registered_domains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

