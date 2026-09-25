-- AlterTable
ALTER TABLE "orders" ADD COLUMN "public_reference" TEXT,
ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_reference_key" ON "orders"("public_reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_store_id_idempotency_key_key" ON "orders"("store_id", "idempotency_key");
