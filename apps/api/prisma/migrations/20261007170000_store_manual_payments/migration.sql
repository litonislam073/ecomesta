-- Offline payment options per store (Cash on delivery, bank transfer, other).
-- Additive. Every existing store keeps all three on, exactly as checkout behaves today.
ALTER TABLE "stores"
  ADD COLUMN "payment_cod_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "payment_bank_transfer_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "payment_bank_transfer_details" TEXT,
  ADD COLUMN "payment_other_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "payment_other_details" TEXT;
