-- When a Super Admin last opened the Users list, for the sidebar "new users" badge.
ALTER TABLE "users" ADD COLUMN "admin_users_seen_at" TIMESTAMP(3);
