DO $$ BEGIN
  CREATE TYPE "AdminRole" AS ENUM ('NONE', 'SUPPORT_READONLY', 'BILLING_ADMIN', 'CATALOG_ADMIN', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR', 'ONE_TIME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminRole" "AdminRole" NOT NULL DEFAULT 'NONE';

CREATE TABLE IF NOT EXISTS "BillingPlan" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPlan_key_key" ON "BillingPlan"("key");
CREATE INDEX IF NOT EXISTS "BillingPlan_status_updatedAt_idx" ON "BillingPlan"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "BillingPrice" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "interval" "BillingInterval" NOT NULL,
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "effectiveAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPrice_planId_version_key" ON "BillingPrice"("planId", "version");
CREATE INDEX IF NOT EXISTS "BillingPrice_currency_interval_effectiveAt_idx" ON "BillingPrice"("currency", "interval", "effectiveAt");

CREATE TABLE IF NOT EXISTS "FeatureDefinition" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FeatureDefinition_key_key" ON "FeatureDefinition"("key");

CREATE TABLE IF NOT EXISTS "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "limit" INTEGER,
  "metadata" JSONB,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanEntitlement_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanEntitlement_planId_featureId_key" ON "PlanEntitlement"("planId", "featureId");

CREATE TABLE IF NOT EXISTS "BillingCustomer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerCustomerCode" TEXT,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_userId_key" ON "BillingCustomer"("userId");
CREATE INDEX IF NOT EXISTS "BillingCustomer_providerCustomerCode_idx" ON "BillingCustomer"("providerCustomerCode");

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerSubscriptionCode" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_provider_providerSubscriptionCode_key" ON "Subscription"("provider", "providerSubscriptionCode");
CREATE INDEX IF NOT EXISTS "Subscription_userId_status_currentPeriodEnd_idx" ON "Subscription"("userId", "status", "currentPeriodEnd");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "provider" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "providerTransactionId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_reference_key" ON "Payment"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerTransactionId_key" ON "Payment"("provider", "providerTransactionId");
CREATE INDEX IF NOT EXISTS "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "ProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "ProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderEvent_provider_eventId_key" ON "ProviderEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "ProviderEvent_provider_eventType_createdAt_idx" ON "ProviderEvent"("provider", "eventType", "createdAt");
