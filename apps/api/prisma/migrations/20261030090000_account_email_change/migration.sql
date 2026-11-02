-- Merchants can change their account email: the new address waits in
-- pending_email until its emailed link (an EMAIL_CHANGE token) is opened.
ALTER TYPE "AuthTokenPurpose" ADD VALUE 'EMAIL_CHANGE';

ALTER TABLE "users" ADD COLUMN "pending_email" CITEXT;
