-- Keep the live Prisma-created, quoted table and column names intact.
-- The application uses NextAuth and server-side Prisma/service-role access;
-- direct anon/authenticated PostgREST access is intentionally denied.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "twoFactorSecret" text,
  ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodes" jsonb;

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workflow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowExecution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "Account", "Session", "AppToken", "Workflow", "WorkflowExecution",
  "Notification", "UsageMetric", "AuditLog"
FROM anon, authenticated;

DROP POLICY IF EXISTS "deny_anon_authenticated_account" ON "Account";
CREATE POLICY "deny_anon_authenticated_account"
  ON "Account" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_authenticated_session" ON "Session";
CREATE POLICY "deny_anon_authenticated_session"
  ON "Session" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_authenticated_app_token" ON "AppToken";
CREATE POLICY "deny_anon_authenticated_app_token"
  ON "AppToken" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_authenticated_workflow" ON "Workflow";
CREATE POLICY "deny_anon_authenticated_workflow"
  ON "Workflow" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_authenticated_workflow_execution" ON "WorkflowExecution";
CREATE POLICY "deny_anon_authenticated_workflow_execution"
  ON "WorkflowExecution" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_authenticated_notification" ON "Notification";
CREATE POLICY "deny_anon_authenticated_notification"
  ON "Notification" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_authenticated_usage_metric" ON "UsageMetric";
CREATE POLICY "deny_anon_authenticated_usage_metric"
  ON "UsageMetric" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_authenticated_audit_log" ON "AuditLog";
CREATE POLICY "deny_anon_authenticated_audit_log"
  ON "AuditLog" FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
  END IF;
END $$;
