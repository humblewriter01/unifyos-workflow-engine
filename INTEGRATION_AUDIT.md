# Integration & App Audit — UnifyOS

**Date:** 2026-10-22
**Commit audited:** `c6d46a2` (`main`)
**Method:** static read of the source tree + the live production health endpoint
(`GET https://unifyos-workflow-engine.vercel.app/api/health`, captured
`2026-10-22T15:44:37.780Z`) + Vercel environment inventory.

---

## 1. The short answer

| Question | Answer |
|---|---|
| Apps in the catalog | **10** |
| Apps fully working end-to-end | **3** (Google Workspace, Slack, Notion) |
| Google service surfaces inside that one connection | **9** |
| Apps where OAuth completes but there are **no features** | **4** (Asana, HubSpot, Salesforce, Monday.com) |
| Apps that are catalog-only (no OAuth at all) | **1** (Trello) |
| Apps missing credentials right now | **5** |
| Apps you named that have **zero code** in the repo | **2** (Microsoft, Dropbox) |
| Non-app platform services wired up | **3** (Supabase = data, Resend = email, Paystack = billing **disabled**) |

So: **10 catalog apps, 5 configured, 5 blocked on keys, and 7 real feature
areas** (9 Google APIs + Slack + Notion + the 4 OAuth-only shells).

> **Read this before planning more apps.** Four of the ten catalog entries are
> *shells*: `/api/apps/[id]/connect` and `/callback` will happily complete the
> OAuth handshake and write an `AppToken` row, but **no route in the codebase
> ever calls Asana, HubSpot, Salesforce or Monday.com APIs**. Connecting them
> today produces a token and nothing else. Filling those in is a different
> (larger) job than adding keys.

---

## 2. What actually exists — the three layers

The integration system is spread across three layers that do not agree with
each other.

### Layer 1 — the registry: `apps/frontend/lib/integrations.ts`

A hardcoded `INTEGRATIONS` array of 10 definitions, each with `requiredEnv`.
`configured` is computed as *"every required env var is non-empty"*. This is the
only source of truth for the UI badges and for `/api/health`.

### Layer 2 — the OAuth machinery

- `apps/frontend/pages/api/apps/[id]/connect.ts` — builds the authorize URL.
  Has `switch` cases for **9** providers. Anything else returns
  `501 INTEGRATION_OAUTH_NOT_IMPLEMENTED`.
- `apps/frontend/pages/api/apps/[id]/callback.ts` — exchanges the code for a
  token. Also **9** providers (`notion` handled separately because it wants
  HTTP Basic + `Notion-Version`).
- `apps/frontend/lib/oauth.ts` — token encryption (`ENCRYPTION_KEY`) and the
  signed, single-use `state` parameter with an open-redirect guard.

Resulting tokens land in **`AppToken`** (`appName` = the integration id).

### Layer 3 — the features

| Integration | Feature routes | Depth |
|---|---|---|
| Google Workspace | `pages/api/integrations/google/**` — 11 routes | **Deep**: Drive, Docs, Sheets, Slides, Gmail, Calendar (+Meet), Forms, Tasks, Contacts, all via `@googleapis/*` |
| Slack | `integrations/slack/channels`, `message`, `events` | **Moderate**: list channels, post messages, receive Events API webhooks |
| Notion | `integrations/notion/search`, `pages` | **Thin**: search, create a page |
| Asana / Monday / HubSpot / Salesforce | *none* — OAuth handshake only | **None** |
| Trello | *none* — no OAuth case either | **None** |

---

## 3. Live status (authoritative, from production)

```
GET /api/health
{
  "success": true, "status": "live",
  "services": { "api": "operational", "database": "unchecked",
                "data": "configured", "redis": "not_configured" },
  "integrations": {
    "google":     "configured",
    "slack":      "configured",
    "gmail":      "configured",
    "calendar":   "configured",
    "notion":     "configured",
    "trello":     "available",
    "asana":      "available",
    "hubspot":    "available",
    "salesforce": "available",
    "monday":     "available"
  }
}
```

`configured` = all required env vars present. `available` = at least one is
missing (the definition is known, the credentials are not).

### Per-integration verdict

| # | Catalog entry | Credentials | Code behind it | Verdict |
|---|---|---|---|---|
| 1 | **Google Workspace** (`google`) | ✅ present | 9 API clients, 11 routes, settings UI | **Fully functional** |
| 2 | **Slack** | ✅ present | OAuth + 3 routes (channels, message, events) | **Functional** — list channels, post, receive events |
| 3 | **Notion** | ✅ present | OAuth + 2 routes (search, create page) | **Functional but thin** |
| 4 | **Gmail** (`gmail`) | ✅ (shared Google app) | Legacy per-app OAuth only | **Superseded** — see §6 |
| 5 | **Google Calendar** (`calendar`) | ✅ (shared Google app) | Legacy per-app OAuth only | **Superseded** — see §6 |
| 6 | **Asana** | ❌ | OAuth handshake only | **Shell** — no Asana API calls anywhere |
| 7 | **Monday.com** | ❌ | OAuth handshake only | **Shell** |
| 8 | **HubSpot** | ❌ | OAuth handshake only | **Shell** |
| 9 | **Salesforce** | ❌ | OAuth handshake only | **Shell** |
| 10 | **Trello** | ❌ | **No OAuth case** → `501` | **Catalog only** — clicking Connect returns "OAuth flow is not implemented yet" |

---

## 4. What you must fetch, and where

Env vars currently set in Vercel (21, production target only):
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY`,
`APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NODE_ENV`, `DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ENCRYPTION_KEY`,
`REQUIRE_EMAIL_VERIFICATION`, `BILLING_ENABLED`, `SLACK_CLIENT_ID`,
`SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `NOTION_CLIENT_ID`,
`NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`.

`ENCRYPTION_KEY` is already set, so **every remaining OAuth app needs only its
two credentials** — no new encryption key.

### 4a. Needed for the four OAuth shells (keys unlock the handshake, not features)

| App | Env vars | Where to get them | Redirect URI to register |
|---|---|---|---|
| **Asana** | `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET` | app.asana.com/0/my-apps → Create app → OAuth | `<APP_URL>/api/apps/asana/callback` |
| **Monday.com** | `MONDAY_CLIENT_ID`, `MONDAY_CLIENT_SECRET` | developer.monday.com/apps → Create app → OAuth | `<APP_URL>/api/apps/monday/callback` |
| **HubSpot** | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` | developers.hubspot.com → Create app → Auth tab | `<APP_URL>/api/apps/hubspot/callback` |
| **Salesforce** | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` | Setup → App Manager → New Connected App. Client ID = **Consumer Key**, secret = **Consumer Secret** | `<APP_URL>/api/apps/salesforce/callback` |

Salesforce specifics: enable OAuth, tick *Require secret for Web Server Flow*,
and add `<APP_URL>` to **Trusted Domains for redirects**. Their IP restrictions
often block serverless egress — expect to relax "IP Relaxation" to *Relax IP
restrictions*.

### 4b. Trello — needs a decision, not just keys

The registry asks for `TRELLO_API_KEY` + `TRELLO_API_SECRET` (api key + token,
from trello.com/app-key), but **Trello's OAuth is 1.0a**, which the generic
`connect.ts` (OAuth 2.0 authorization-code) cannot express. There is no
`case 'trello'`, so it returns `501`.

Two options:

1. **Ship it as API-key + token** (`TRELLO_API_KEY` + a per-user token the user
   pastes) — no OAuth flow, works immediately, worse UX.
2. **Implement OAuth 1.0a** — needs a request-token step, HMAC-SHA1 signing,
   and a separate callback. ~1 day of work.

Do not set `TRELLO_API_KEY` alone and expect the Connect button to start
working; it will still 501.

### 4c. Paystack (billing — currently switched off)

| Env var | Status | Note |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | ❌ **missing** | `sk_live_…`. Webhook signature verification uses this same key |
| `BILLING_ENABLED` | ✅ `false` | Code comment: "Keep billing disabled until PAYSTACK_SECRET_KEY is supplied and verified" |

`lib/paystack.ts` and `pages/api/billing/{initialize,verify,webhook}.ts` are
**fully written**. To turn billing on: set `PAYSTACK_SECRET_KEY`, point
Paystack's dashboard webhook at `<APP_URL>/api/billing/webhook`, verify one test
transaction, then flip `BILLING_ENABLED=true`.

---

## 5. Apps you named that do not exist in this codebase

A repo-wide search for `microsoft`, `outlook`, `graph.microsoft.com`,
`dropbox`, `airtable`, `github` (as a provider), `stripe` returns **zero
matches**. There are no stubs, no registry entries, no env vars, no
documentation. Microsoft and Dropbox are not "missing keys" — they are
**unstarted features**.

If you want them, here is what each needs:

| App | Env vars | Notes |
|---|---|---|
| **Microsoft 365 / Outlook** | `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID` (`common` for multi-tenant) | Azure Portal → App registrations. Microsoft Graph scopes: `Mail.ReadWrite`, `Calendars.ReadWrite`, `Files.ReadWrite`, `User.Read`, `offline_access`. Redirect `<APP_URL>/api/apps/microsoft/callback` |
| **Dropbox** | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` | dropbox.com/developers/apps → Scoped access. Scopes `files.content.read`, `files.content.write`, `sharing.read`. Redirect `<APP_URL>/api/apps/dropbox/callback` |
| **Airtable** | `AIRTABLE_CLIENT_ID`, `AIRTABLE_CLIENT_SECRET` (OAuth) *or* `AIRTABLE_PAT` (simpler, single-account) | OAuth supports PKCE, no client secret strictly required |
| **GitHub** | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth App. Scopes `repo`, `read:user`. Redirect `<APP_URL>/api/apps/github/callback` |
| **Linear** | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | `api.linear.app/oauth/authorize` |
| **Jira / Atlassian** | `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET` | Scopes `read:jira-work`, `write:jira-work`, `offline_access` |
| **Stripe** (if you outgrow Paystack) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Would need a second adapter behind the existing billing interface |

**No AI/LLM provider is configured anywhere** (no `OPENAI_*`, `ANTHROPIC_*`,
`GEMINI_*`). If any workflow action is meant to summarise, classify or draft
text, that key set does not exist yet either.

---

## 6. Defects found during the audit

These are real and worth fixing before adding more apps.

**6.1 Gmail / Calendar are duplicated and disagree.**
`/api/integrations/google/*` reads the token stored under `appName = 'google'`.
But `/api/apps/gmail/connect` writes a *separate* row under `appName = 'gmail'`
(and likewise `calendar`). So a user who connects from the **Gmail** card sees
"connected" in the catalog while the Gmail test route reports
`GOOGLE_NOT_CONNECTED`, and vice versa. Two connections, two token rows, one
confusing UI.
*Fix:* retire the `gmail` and `calendar` catalog cards and point them at the
unified Google card. (No schema change required — stop writing the extra rows.)

**6.2 Trello's registry entry cannot work as written** — see §4b. The Connect
button advertises an app that returns `501`.

**6.3 Orphaned integration code.** `apps/api/lib/integrations/{asana,google,monday,notion,slack,trello}.ts`
contain real API calls — including the only Trello implementation in the repo
(`trello.com/1/cards`, `members/me/boards`) — but **nothing imports them**.
`apps/api/src/server.js` never requires them, and `apps/api` is not deployed
(the Vercel project builds `apps/frontend` only). Also present:
`apps/api/apps/frontend/pages/api/auth/signup.ts`, a stray duplicated file at a
nonsensical path.
*Fix:* either wire them in or delete them. Dead code is why Trello *looks*
implemented in a code review but 501s in production.

**6.4 `buildGoogleConsentUrl()` in `lib/google-auth.ts` is dead.**
Its docblock says "Consent URL used by the integration Connect button", but
nothing calls it — the real Connect flow is `/api/apps/google/connect`. Misleading
for the next reader.

---

## 7. Recommended order of work

1. **Nothing.** Configure keys only when you plan to build features: setting
   `ASANA_CLIENT_ID` today makes a green "Configured" badge appear for an app
   that still does nothing. That is worse than leaving it grey.
2. **Decide the four shells.** Either build one end-to-end (Asana is the
   smallest: tasks + projects = 3 routes), or move them out of the catalog into
   a "Coming soon" list so the UI stops over-promising.
3. **Fix 6.1 (Gmail/Calendar duplication)** — ~30 minutes, high user confusion
   payoff.
4. **Trello:** pick option 1 or 2 from §4b.
5. **Then** add new apps. Microsoft first if your users are enterprise —
   it is the only one that competes with the Google suite you just shipped.

Per-app effort estimate once keys exist, following the existing pattern:
a read-only route set is ~2–4 hours; a full CRUD surface like the Google suite
is ~1–2 days including the settings UI and tests.
