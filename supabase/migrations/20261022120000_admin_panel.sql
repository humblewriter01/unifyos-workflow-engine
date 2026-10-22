-- Admin panel: audit/event log + promo codes.
--
-- Idempotent: safe to re-run, and safe to apply through `prisma migrate deploy`
-- or by pasting into the Supabase SQL editor.
--
-- These are the ONLY new tables in this change set. No existing table, enum,
-- trigger or RLS policy is touched.

DO $$ BEGIN
  CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FLAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id"         TEXT NOT NULL,
  "adminId"    TEXT,
  "adminEmail" TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "targetType" TEXT,
  "targetId"   TEXT,
  "metadata"   JSONB,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_createdAt_idx"
  ON "admin_audit_logs"("action", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx"
  ON "admin_audit_logs"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_targetId_idx"
  ON "admin_audit_logs"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id"              TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "description"     TEXT,
  "discountType"    "PromoDiscountType" NOT NULL,
  "discountValue"   INTEGER NOT NULL,
  "currency"        TEXT,
  "maxUses"         INTEGER,
  "maxUsesPerUser"  INTEGER NOT NULL DEFAULT 1,
  "usedCount"       INTEGER NOT NULL DEFAULT 0,
  "redeemedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "startsAt"        TIMESTAMP(3),
  "expiresAt"       TIMESTAMP(3),
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "createdBy"       TEXT,
  "createdByEmail"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key"
  ON "promo_codes"("code");
CREATE INDEX IF NOT EXISTS "promo_codes_active_expiresAt_idx"
  ON "promo_codes"("active", "expiresAt");

-- Row level security: enabled with NO policies, so PostgREST/anon/authenticated
-- clients can read nothing. Prisma connects as the table owner and is not
-- affected by RLS unless FORCE ROW LEVEL SECURITY is set (it is not).
-- Existing policies on the original tables are untouched.
ALTER TABLE "admin_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "promo_codes"      ENABLE ROW LEVEL SECURITY;
