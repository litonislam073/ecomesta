-- Super Admins can soft-delete a store (restorable) or delete it permanently.
-- A soft-deleted store frees its address: `slug` gets a placeholder and the
-- original waits in `deleted_slug` for a restore.
ALTER TABLE "stores"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_slug" CITEXT,
  ADD COLUMN "status_before_deletion" "StoreStatus";

CREATE INDEX "stores_deleted_at_idx" ON "stores"("deleted_at");
