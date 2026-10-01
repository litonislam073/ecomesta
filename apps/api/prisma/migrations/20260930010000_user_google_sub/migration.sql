-- Sign in with Google: remember the Google account a user signed in with.
-- Additive only: one nullable column and its unique index, no changes to existing rows.

ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;

CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");
