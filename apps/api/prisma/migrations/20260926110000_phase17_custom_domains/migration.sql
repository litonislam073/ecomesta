-- Phase 17: Custom domains — verification token + VERIFIED status
ALTER TYPE "DomainStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';

ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "verification_token" VARCHAR(128);

CREATE INDEX IF NOT EXISTS "domains_status_idx" ON "domains"("status");
