-- Phase 15: Super Admin audit log search filters by action
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
