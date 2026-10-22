# UnifyOS — Workspace Capability & Integration Audit

**Audit date:** 22 October 2026
**Commit audited:** `e0411ad` (main, deployed to https://unifyos-workflow-engine.vercel.app)
**Method:** static read of the whole monorepo, route-to-UI cross-check, live probing of the production deployment, and read-only queries against the production database.

> This supersedes the older `AUDIT.md` / `FIXES_REQUIRED.md` / `PRODUCTION_READINESS_*.md` documents, which describe an Express API + Supabase-only architecture that no longer exists in the deployed app.

---

## 1. TL;DR

1. **The product is a UI over a data model with no runtime.** `packages/engine` and `packages/shared` are empty (only `.gitkeep` + `requirements.txt`). There is no scheduler, queue, worker or HTTP trigger. A saved workflow never runs. "Test workflow" writes a `WorkflowExecution` row marked `simulated: true`.
2. **Nine integrations are connectable, three do real work.** Google Workspace (9 services), Slack and Notion have working read/write API calls. Asana, HubSpot, Salesforce and Monday.com perform OAuth and store a token, then have **no actions at all**. Trello is in the catalog but has **no OAuth implementation**.
3. **Production has 2 users, 0 workflows, 0 executions and 0 connected app tokens.** Nothing has been exercised end-to-end yet.
4. **Billing cannot work today:** `BillingPlan` and `BillingPrice` are empty, `BILLING_ENABLED` is off, and `PAYSTACK_SECRET_KEY` is not set.
5. **Two features read the wrong database schema.** Analytics and the Unified Inbox query legacy Supabase tables (`workflows`, `workflow_executions`, `app_tokens`, `notifications` — snake_case), while the application writes to Prisma tables (`Workflow`, `WorkflowExecution`, `AppToken`, `Notification` — PascalCase). Both therefore always show zeros/empty, even once real data exists.
6. **Three endpoints the UI calls do not exist**: `PUT /api/user/profile`, `POST /api/user/export`, `DELETE /api/user/delete`. Profile saving, data export and account deletion all 404.
7. **Notification mutations are no-ops.** `PATCH /api/notifications/[id]/read` and `PATCH /api/notifications/read-all` return success without touching a database.
8. **No import/export of business data exists.** The only export affordance in the UI is the broken `/api/user/export` button.
9. **Operational quality is thin:** no unit/integration tests, no CI beyond deploy, no error tracking, no rate limiting on any non-auth route.
10. **The admin panel is the most complete subsystem** — kill switch, integration health, global workflow control, users, support inbox, promo codes, announcements, email blasts, audit trail — and it is enforced server-side at both the edge (`middleware.ts`) and in every API handler (`requireAdmin`).

---

## 2. What is actually deployed

| Component | Reality | Evidence |
| --- | --- | --- |
| Web app | Next.js 14 pages router, deployed on Vercel (Hobby) | `apps/frontend`, project `unifyos-workflow-engine` |
| Database | Postgres on Supabase (eu-west-1), accessed through Prisma | `DATABASE_URL`, 25 public tables |
| Second data plane | Supabase JS client used by analytics/notifications and email logging | `lib/supabase.ts` |
| Automation engine | **Does not exist** | `packages/engine` empty |
| Background jobs | **None** — no cron, no queue, no worker | no `vercel.json`, no queue dependency |
| Legacy Express API | Present but not deployed; duplicates a subset of the Next API | `apps/api/src/server.js` (190 lines) |
| CI | Deploy on push + Supabase keep-alive only | `.github/workflows/{deploy,supabase-keepalive}.yml` |
| Tests | **None** | no `*.test.ts`, no runner configured |

---

## 3. Integration inventory

### 3.1 Live configuration status

From `GET /api/health` on production:

```
google: configured   slack: configured   gmail: configured   calendar: configured
notion: configured   trello: available   asana: available    hubspot: available
salesforce: available   monday: available
```

`available` means the provider is in the catalog but its client credentials are **not** set.

### 3.2 Capability matrix

| App | Credentials in prod | OAuth connect | Token persisted | Real API actions | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Google Workspace** (umbrella) | ✅ | ✅ `POST /api/apps/google/connect` | ✅ `AppToken(appName='google')`, encrypted, refresh handled | ✅ 9 services (see 3.3) | **Fully wired** |
| Gmail | ✅ (same creds) | ✅ | ✅ | ✅ list unread (read) | Wired as Google service |
| Google Calendar | ✅ (same creds) | ✅ | ✅ | ✅ list upcoming, create event | Wired as Google service |
| **Slack** | ✅ | ✅ | ✅ | ✅ `conversations.list`, `chat.postMessage`, events receiver | Wired (read + write) |
| **Notion** | ✅ | ✅ | ✅ | ✅ `/v1/search`, create page | Wired (read + write) |
| Trello | ❌ | ❌ **not implemented** | — | ❌ | **Catalog-only** |
| Asana | ❌ | ✅ code path | would be stored | ❌ | **OAuth-only** |
| HubSpot | ❌ | ✅ code path | would be stored | ❌ | **OAuth-only** |
| Salesforce | ❌ | ✅ code path | would be stored | ❌ | **OAuth-only** |
| Monday.com | ❌ | ✅ code path | would be stored | ❌ | **OAuth-only** |

Notes:
- Connectable ids are exactly: `slack, google, gmail, calendar, notion, asana, monday, hubspot, salesforce` (`pages/api/apps/[id]/connect.ts`). `trello` falls through to "unknown integration".
- Tokens are AES-encrypted with `ENCRYPTION_KEY` and stored in `AppToken`; `getUserAppToken()` returns `null` for expired tokens.
- Google tokens auto-refresh and rewrite the stored refresh token (`lib/google-auth.ts`). Slack/Notion tokens do not expire.

### 3.3 Google Workspace — what each service can actually do

All are authenticated calls against Google APIs with per-service error reporting, exposed both as API routes and as "Test" buttons on `/settings/integrations`.

| Service | Endpoint | Capability | Scope |
| --- | --- | --- | --- |
| Drive | `GET /api/integrations/google/drive/list` | list 5 recently modified files | `drive` |
| Docs | `POST .../docs/create` | create a blank document | `documents` |
| Sheets | `POST .../sheets/read` | read a range (e.g. `A1:C5`) | `spreadsheets` |
| Slides | `POST .../slides/create` | create a blank presentation | `presentations` |
| Gmail | `GET .../gmail/list` | list 5 recent unread messages | `gmail.modify` |
| Calendar | `GET .../calendar/list` | list 5 upcoming events | `calendar` |
| Forms | `GET .../forms/list` | list 5 recently modified forms | `forms.responses.readonly` |
| Tasks | `POST .../tasks/create` | create a task | `tasks` |
| Contacts | `GET .../contacts/list` | list 5 recently modified contacts | `contacts` |

Status: `GET /api/integrations/google/status` reports connection, granted scopes and whether a re-connect is needed (missing refresh token).

**Important:** these are *capabilities of the integration layer*, not of workflows. Nothing in the workflow runtime calls them — see §7.1.

### 3.4 Sign-in vs. connect (two different Google flows)

- **Sign-in** (`/api/auth/[...nextauth]`): Google ID token, profile scopes only, `prompt=select_account`. It does **not** grant Workspace scopes.
- **Connect** (`/api/apps/google/connect`): `access_type=offline`, `prompt=consent`, full scope set, `include_granted_scopes=true`, returns `AppToken`.

This separation is deliberate and should be preserved.

---

## 4. What a user can do today

### Accounts & security
- Sign up with email + password, or with Google.
- Email verification (`REQUIRE_EMAIL_VERIFICATION`), password reset, resend verification.
- TOTP two-factor: setup, enable, disable, recovery codes (`/settings/security`, `/api/user/2fa/*`).
- Change password.
- ❌ **Save profile** — the form calls `PUT /api/user/profile`, which does not exist (404).
- ❌ **Export my data** — calls `POST /api/user/export`, which does not exist (404).
- ❌ **Delete my account** — calls `DELETE /api/user/delete`, which does not exist (404); on success it would redirect to `/auth/deleted`, a page that is also absent.

### Dashboard
- `/` overview, `/analytics`, `/inbox`, `/workflows`, `/apps`, `/billing`, `/settings/*`, `/contact`.
- Announcement banner + impersonation bar (`/admin/announcements`, 1-hour impersonation sessions).

### Workflows
- Build a workflow in `components/WorkflowBuilder.tsx` from **4 hard-coded triggers** (Gmail new email, Slack message, Calendar event starting, Notion database updated) and **5 hard-coded actions** (Slack send message, Gmail send email, Notion create page, Calendar create event, Trello create card).
- Save it (`POST /api/workflows`) → `Workflow` row with `triggerApp`, `triggerEvent`, `actions` JSON.
- Enable/disable, rename, delete (`/api/workflows/[id]`).
- "Test" it (`POST /api/workflows/[id]/test`) → creates a `WorkflowExecution` marked `simulated: true`, increments `executionCount`. Respects the kill switch and the workflow's `enabled` flag.
- ❌ Nothing is ever triggered by a real event. The listed apps in the builder (including Trello) are labels, not bindings.

### Integrations
- Connect/disconnect Google Workspace, Slack, Notion (and OAuth-only Asana/HubSpot/Salesforce/Monday once credentials exist).
- Run per-service Google tests and see raw JSON responses.
- ❌ Configure an action's target (channel, spreadsheet id, database, etc.) — no per-app configuration UI beyond the Sheets range input on the test panel.

### Billing
- `/billing` lists `PUBLISHED` plans with prices, shows current subscription and payment history.
- `POST /api/billing/initialize` → Paystack; `GET /api/billing/verify` → verifies amount + currency before granting; webhook is signature-verified, deduplicated via `ProviderEvent`, and handles refunds.
- Promo codes: quote at checkout, discounted amount charged, idempotent redemption after success.
- ❌ **Not operable in production today** — no plans, no prices, billing disabled, no Paystack key.

### Notifications / inbox
- Inbox lists notifications from the legacy `notifications` Supabase table.
- ❌ Nothing ever creates a notification, and the table is empty.
- ❌ "Mark read" endpoints return success without persisting.

### Support
- `/contact` submits a ticket → persisted in `admin_audit_logs` (`support.ticket`) first, then emailed (needs `SUPPORT_EMAIL`).
- Admin inbox at `/admin/support` with view + Resolve.

### Administration (SUPER_ADMIN, MFA required)
| Surface | Capability |
| --- | --- |
| `/admin` | platform overview, recent admin events |
| `/admin/health` | per-integration health: connected / expired / needs re-connect, from `AppToken` |
| `/admin/workflows` | every user's workflows, disable/enable (audited) |
| `/admin/users` | role + plan change, subscription extension, **impersonation links**, per-user drill-down |
| `/admin/support` | ticket inbox |
| `/admin/plans` | billing plan catalog (create plan + price, publish) |
| `/admin/promo-codes` | create/disable/delete promo codes |
| `/admin/announcements` | publish/clear dashboard banner |
| `/admin/email` | targeted blasts (ALL/FREE/PRO/BUSINESS) with test-send |
| `/admin/audit` | full audit trail |
| kill switch | `POST /api/admin/kill-switch` pauses all executions; every execution path must call `assertWorkflowExecutionAllowed()` |

---

## 5. Data model reality

25 public tables, split across **two naming conventions**:

**Prisma-managed (used by the app):** `User, Account, Session, Workflow, WorkflowExecution, AppToken, Notification, BillingCustomer, BillingPlan, BillingPrice, PlanEntitlement, FeatureDefinition, Subscription, Payment, ProviderEvent, UsageMetric, AuditLog, admin_audit_logs, promo_codes`

**Legacy Supabase (snake_case, written by an older version):** `users, workflows, workflow_executions, app_tokens, notifications, keep_alive`

Live row counts (22 Oct 2026):

| Table | Rows | Table | Rows |
| --- | --- | --- | --- |
| `User` | 2 | `Workflow` | 0 |
| `WorkflowExecution` | 0 | `AppToken` | 0 |
| `Notification` | 0 | `notifications` (legacy) | 0 |
| `BillingPlan` | **0** | `BillingPrice` | **0** |
| `Subscription` | 0 | `Payment` | 0 |
| `admin_audit_logs` | 0 | `promo_codes` | 0 |

Consequences:
- `/analytics` and `/inbox` read the legacy tables → permanently empty (`pages/api/analytics/stats.ts`, `pages/api/notifications/index.ts`).
- `/billing` has nothing to sell; `/admin/plans` is the only way to create the catalog.
- The integration health monitor will legitimately report "0 connected" until someone connects an app.

---

## 6. Import / export status

| Capability | Status | Evidence |
| --- | --- | --- |
| Export account data (JSON) | ❌ **Broken** | `settings/account.tsx` → `POST /api/user/export` → route missing (404) |
| Export workflows (JSON) | ❌ Absent | no route, no button |
| Export executions / analytics (CSV) | ❌ Absent | no route |
| Export contacts / CRM records | ❌ Absent | no CRM data model at all |
| Export audit log | ⚠️ Partial | readable via `GET /api/admin/audit-logs`, but no download |
| Import workflows (JSON) | ❌ Absent | — |
| Import contacts / CSV | ❌ Absent | — |
| Import files from Drive | ❌ Absent | Drive is list-only (`drive/list`); no download/deposit route |
| File upload / storage | ❌ Absent | only Supabase `email_logs` writes |
| Inbound event ingestion | ⚠️ One path | `POST /api/integrations/slack/events` verifies and acknowledges, then discards |
| Outbound webhooks | ❌ Absent | — |
| Public/API-key API | ❌ Absent | all routes are session-authenticated |

---

## 7. What is missing

### P0 — blocks the product from being a product

1. **No execution engine.** No scheduler, queue, worker, retry or idempotent runner. Workflows are inert rows. All that exists is `assertWorkflowExecutionAllowed()` (kill-switch guard) waiting for a caller. *Everything in the integrations layer is unreachable from automation until this exists.*
2. **No triggers.** No cron schedules, no inbound HTTP workflow triggers, no provider webhook subscriptions (Slack events payload is discarded, Google/Slack/Notion have no push registration).
3. **Three dead endpoints in the settings UI** (`/api/user/profile`, `/api/user/export`, `/api/user/delete`) — profile editing, GDPR-style export and account deletion all fail with 404.
4. **Billing is not operable:** empty plan/price catalog, `BILLING_ENABLED` off, no `PAYSTACK_SECRET_KEY`.
5. **Analytics and Inbox read the legacy schema** — the two "insight" surfaces can never show real data.

### P1 — expected features that are absent or half-built

6. **Trello** advertised but not implemented (no OAuth case in `connect.ts`).
7. **Asana, HubSpot, Salesforce, Monday.com** are connection-only: no read/write actions, so "integrate" means "store a token".
8. **No per-app action configuration** in the builder (no channel picker, spreadsheet picker, board picker).
9. **Notification pipeline missing:** nothing creates notifications; mark-read endpoints are stubs.
10. **No import/export of business data** (§6).
11. **No tests, no lint gate in CI**, no error tracking (Sentry or equivalent), no structured logging.
12. **Rate limiting only on auth routes**; workflow/integration/admin APIs are unthrottled.
13. **Legacy duplicate artifacts:** `apps/api` Express server, nested duplicate `apps/api/apps/frontend/...`, `apps/api/lib/integrations/*`, and the snake_case tables. Confusing and a security/consistency risk (two copies of "the API").

### P2 — product depth

14. No teams/organisations, roles or sharing — every account is a single-user silo.
15. No workflow versioning, draft/publish, or rollback.
16. No execution detail view for end users (only aggregate counters); admins get a list but no per-step traces.
17. No scheduled/delayed actions, branching, loops, filters or error branches in the builder (linear list only).
18. No templates/gallery.
19. No i18n, no accessibility audit, no mobile-specific layouts.
20. No data retention policy for `WorkflowExecution` / `ProviderEvent` / `admin_audit_logs`.

---

## 8. Configuration matrix (production)

| Variable | Set | Needed for |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Prisma / whole app |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | ✅ | sessions, impersonation signing |
| `APP_URL` | ✅ | OAuth redirects |
| `GOOGLE_CLIENT_ID/SECRET` | ✅ | sign-in + Google Workspace |
| `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET` | ✅ | Slack connect + events |
| `NOTION_CLIENT_ID/SECRET/REDIRECT_URI` | ✅ | Notion connect |
| `ENCRYPTION_KEY` | ✅ | token encryption at rest |
| `RESEND_API_KEY` | ✅ | transactional + blast email |
| `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ | legacy analytics/inbox, email logs |
| `REQUIRE_EMAIL_VERIFICATION` | ✅ | signup policy |
| `BILLING_ENABLED` | ✅ (false) | checkout gate |
| `PAYSTACK_SECRET_KEY` | ❌ | any payment |
| `SUPPORT_EMAIL` | ❌ | support notification email (tickets still persist) |
| `EMAIL_FROM` | ❌ | branded sender (falls back to `onboarding@resend.dev`) |
| `ASANA_*`, `HUBSPOT_*`, `SALESFORCE_*`, `MONDAY_*`, `TRELLO_*` | ❌ | those integrations |

Prerequisite for any end-to-end test: create at least one `BillingPlan` + `BillingPrice` via `/admin/plans`, set `PAYSTACK_SECRET_KEY` and `BILLING_ENABLED=true`, and enable MFA on the `SUPER_ADMIN` account (admin APIs reject non-MFA accounts by design).

---

## 9. Recommended sequence

**Sprint 1 — make it demonstrable (no new providers)**
1. Fix the three dead endpoints (profile, export, delete).
2. Repoint analytics + inbox to Prisma (or migrate the legacy tables and delete them).
3. Seed a `FREE`/`PRO` plan + price; turn billing on with a Paystack test key; run one real checkout including a promo code.
4. Connect Google, Slack and Notion on a test account and exercise every `/settings/integrations` test button.

**Sprint 2 — give it a runtime**
5. Implement a minimal executor in `packages/engine`: trigger → resolve action handlers → call the existing integration clients → persist `WorkflowExecution` with per-step results.
6. Wire one trigger end-to-end first (Slack events → workflow → Slack/Gmail action), honouring the kill switch.
7. Add cron scheduling and an inbound webhook trigger, plus retry/backoff and idempotency keys.

**Sprint 3 — breadth and trust**
8. Per-app action configuration UI (channel, sheet, database, board pickers).
9. Real actions for the four OAuth-only CRM/PM apps; either implement Trello or remove it from the catalog.
10. Import/export: workflow JSON, execution CSV, contact CSV.
11. Tests around billing verification, promo maths, auth guards; error tracking; rate limits on workflow/integration routes; delete `apps/api` and the legacy tables.

---

## 10. Appendix — surface inventory

- **68 API routes** under `apps/frontend/pages/api` (auth, billing, workflows, integrations, notifications, apps, user, admin, contact, analytics, health).
- **30 page routes**: 9 top-level (`/`, `/apps`, `/analytics`, `/billing`, `/contact`, `/inbox`, `/workflows`, `/privacy`, `/terms`), 4 `/settings/*`, 7 `/auth/*` (`login`, `logout`, `signup`, `verify-email`, `forgot-password`, `reset-password`, `error`), and 10 `/admin/*` (`index`, `health`, `workflows`, `users`, `support`, `plans`, `promo-codes`, `announcements`, `email`, `audit`).
- **Admin enforcement:** `middleware.ts` gates `/admin*` at the edge on the `adminRole` claim; every `/api/admin/*` handler independently calls `requireAdmin()` (database re-read + MFA requirement). Verified live: unauthenticated `/admin/*` → `307 /auth/login?callbackUrl=…`; admin APIs → `401 AUTH_REQUIRED`.
- **Impersonation:** HMAC-signed, audience-bound, 60-minute, single-use link; the target's password is never read. Verified live: garbage token → `400`, expired → `410`, wrong audience → `400`, valid → passes signature then `503` without a database.
