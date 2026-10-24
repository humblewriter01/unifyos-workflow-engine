# Google Workspace Integrations

Full Google suite for UnifyOS: **Drive, Docs, Sheets, Slides, Gmail, Calendar (with Meet), Forms, Tasks, Contacts**.

> No database schema, Prisma model, SQL trigger, or RLS policy was changed. Google tokens reuse the
> existing `AppToken` table (`appName = 'google'`), encrypted with `ENCRYPTION_KEY`.

---

## 1. What was built

| Step | File | Purpose |
| --- | --- | --- |
| 1 | `apps/frontend/pages/api/auth/[...nextauth].ts` | Sign-in now requests the 9 Workspace scopes with `access_type=offline` and `prompt=consent`. |
| 1 | `apps/frontend/lib/google-scopes.ts` | Single source of truth for scopes (shared by server + UI). |
| 2 | `apps/frontend/lib/google-auth.ts` | Reads the token from `AppToken`, refreshes it when expired, persists the new token, returns an `OAuth2Client`. |
| 3 | `apps/frontend/lib/google.ts` | Exports initialised clients for all nine APIs, plus MIME/URL helpers and `listGoogleForms`. |
| 3 | `apps/frontend/lib/google-route.ts` | Shared auth + client setup + Google error translation for the routes. |
| 4 | `apps/frontend/pages/api/integrations/google/**` | The 10 test routes + a `status` route. |
| 5 | `apps/frontend/pages/settings/integrations.tsx` | Nine service cards with **Connect**, **Reconnect**, **Disconnect** and per-service **Test**. |
| — | `lib/google-services.ts` | Client-safe service metadata (keeps the Google SDK out of the browser bundle). |

### Dependency choice: granular packages

`googleapis` (the monolith) is **246 MB unpacked**. It would bloat every serverless function and slow
cold starts. Instead the official per-API packages are used (`@googleapis/drive`, `…/docs`, `…/sheets`,
`…/slides`, `…/gmail`, `…/calendar`, `…/forms`, `…/tasks`, `…/people`), plus `googleapis-common` for
`OAuth2Client`.

Measured result after `next build`: **544 KB** of traced `@googleapis` code for all nine APIs, and the
`/settings/integrations` page ships **100 kB** of First-Load JS — the same as the existing pages, so no
Google SDK code reaches the browser.

---

## 2. API routes

All routes require a signed-in session and a connected Google account. Responses use the project's
envelope: `{ success, data }` / `{ success: false, error, code }`.

| Method | Route | Behaviour |
| --- | --- | --- |
| GET | `/api/integrations/google/status` | Connection state, granted/missing scopes, per-service readiness. |
| GET | `/api/integrations/google/gmail/list` | 5 most recent **unread** emails (subject/from/date/snippet). |
| GET | `/api/integrations/google/calendar/list` | 5 next upcoming events on the primary calendar. |
| POST | `/api/integrations/google/calendar/create` | Creates an event **with a Google Meet link** via `conferenceData`. |
| GET | `/api/integrations/google/drive/list` | 5 most recently modified files (`?type=document\|sheet\|slide\|form`, `?q=`). |
| POST | `/api/integrations/google/sheets/read` | Reads `{ spreadsheetId, range }`; defaults to the first tab. |
| POST | `/api/integrations/google/docs/create` | Creates a blank Doc, returns `documentId` + edit URL. |
| POST | `/api/integrations/google/slides/create` | Creates a blank presentation, returns ID + edit URL. |
| GET | `/api/integrations/google/forms/list` | 5 recent forms — resolved through **Drive** (see note below). |
| POST | `/api/integrations/google/tasks/create` | Creates a task in `@default`. |
| GET | `/api/integrations/google/contacts/list` | 5 most recently modified contacts. |

### Notes worth knowing

* **Meet needs no extra scope.** Calendar's `conferenceData` creates it; the insert must pass
  `conferenceDataVersion: 1`, which the route does. Google may return the event before the Meet link is
  provisioned, so `meetLink` can be `null` for a moment — the response includes
  `conferenceStatus` so you can tell the difference.
* **Forms cannot be listed with the Forms API.** v1 has no `list` method, and
  `forms.responses.readonly` cannot enumerate forms. The route therefore queries Drive for
  `mimeType='application/vnd.google-apps.form'`. This is why Drive is a required part of the Forms
  integration. (Deliberately, it does **not** call `forms.get` — that would need a scope we don't request.)
* **Drive is the entry point** for Docs, Sheets, Slides and Forms: those APIs only address files by the
  ID Drive returns, which is why `drive` is always requested.
* **Scope changes are incremental-safe.** The connect flow sends `include_granted_scopes=true`, so
  re-consenting never silently drops a previously granted permission.
* **Token refresh** happens with a 60-second skew. Google usually omits a new refresh token on refresh;
  the code preserves the existing one rather than overwriting it with `null`. `invalid_grant` (user
  revoked access) marks the row `connected = false` so the UI can prompt a reconnect.

### Testing the routes by hand

```bash
# while signed in, with a session cookie
curl -s localhost:3000/api/integrations/google/status | jq
curl -s localhost:3000/api/integrations/google/gmail/list | jq '.data.messages[].subject'
curl -s -X POST localhost:3000/api/integrations/google/calendar/create \
  -H 'Content-Type: application/json' -d '{"summary":"UnifyOS test"}' | jq '.data.meetLink'
```

---

## 3. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | **yes** | `…apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | **yes** | Server-only. Never expose with `NEXT_PUBLIC_`. |
| `ENCRYPTION_KEY` | **yes** | 64 hex chars (`openssl rand -hex 32`). Encrypts tokens at rest. |
| `NEXTAUTH_SECRET` | **yes** | Also signs the OAuth `state`. |
| `APP_URL` / `NEXTAUTH_URL` | **yes in prod** | Must be the exact public origin. |
| `GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY` | no | `true` = request only `openid email profile` at sign-in and grant Workspace access only via Settings → Integrations. See §6. |

> Currently `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are **not set** on the Vercel project, so the
> Google provider is never registered and the Connect button returns a configuration error.

---

## 4. Google Cloud Console checklist

Project: your existing UnifyOS OAuth client. Do these in order.

### 4.1 Enable the APIs

APIs & Services → **Library** → enable each:

- [ ] Google Drive API
- [ ] Google Docs API
- [ ] Google Sheets API
- [ ] Google Slides API
- [ ] Gmail API
- [ ] Google Calendar API
- [ ] Google Forms API
- [ ] Google Tasks API
- [ ] People API ← **Contacts**

Each is per-project. If one is disabled, only that service fails (Google returns
`403 … has not been used in project … or is disabled`).

### 4.2 Add the scopes to the OAuth consent screen

APIs & Services → **OAuth consent screen** → Data access → **Add or remove scopes**:

- [ ] `https://www.googleapis.com/auth/drive`
- [ ] `https://www.googleapis.com/auth/documents`
- [ ] `https://www.googleapis.com/auth/spreadsheets`
- [ ] `https://www.googleapis.com/auth/presentations`
- [ ] `https://www.googleapis.com/auth/gmail.modify`
- [ ] `https://www.googleapis.com/auth/calendar`
- [ ] `https://www.googleapis.com/auth/forms.responses.readonly`
- [ ] `https://www.googleapis.com/auth/tasks`
- [ ] `https://www.googleapis.com/auth/contacts`

- [ ] `openid`, `email`, `profile` (non-sensitive)

**Classification matters here:**

| Scope | Class | Consequence |
| --- | --- | --- |
| `gmail.modify` | **Restricted** | Needs Google verification + a security assessment (CASA) before public use. |
| `drive` | **Restricted** | Same; `drive.file` is the lighter alternative if you only need app-created files. |
| `contacts` | **Sensitive** | Needs verification; still works for ≤100 test users. |
| `calendar`, `tasks`, `documents`, `spreadsheets`, `presentations` | **Sensitive** | Verification required for public use. |
| `forms.responses.readonly` | **Sensitive** | Verification required. |

Until verification completes the app shows **"Google hasn't verified this app"** and is capped at
**100 users**. Add yourself under **Test users** while developing.

### 4.3 Authorized redirect URIs

APIs & Services → Credentials → your OAuth 2.0 Client ID → **Authorized redirect URIs**:

- [ ] `http://localhost:3000/api/auth/callback/google` — sign-in, local
- [ ] `https://unifyos-workflow-engine.vercel.app/api/auth/callback/google` — sign-in, production
- [ ] `http://localhost:3000/api/apps/google/callback` — **Workspace Connect, local**
- [ ] `https://unifyos-workflow-engine.vercel.app/api/apps/google/callback` — **Workspace Connect, production**
- [ ] `http://localhost:3000/api/apps/gmail/callback` — legacy per-app connect (optional)
- [ ] `https://unifyos-workflow-engine.vercel.app/api/apps/gmail/callback`
- [ ] `http://localhost:3000/api/apps/calendar/callback`
- [ ] `https://unifyos-workflow-engine.vercel.app/api/apps/calendar/callback`

**Authorized JavaScript origins:**

- [ ] `http://localhost:3000`
- [ ] `https://unifyos-workflow-engine.vercel.app`

Notes:

* Exact match required — scheme, host, path and **no trailing slash**. One mismatch → `redirect_uri_mismatch`.
* Wildcards are **not** supported; each Vercel preview hostname must be added individually.
* The requested scopes must also be on the consent screen, otherwise Google answers with
  `invalid_scope` before the redirect even happens.

### 4.4 When Google says `Error 400: redirect_uri_mismatch`

Google rejects the request **before** the app is involved, so nothing in the
server log or the app's error page explains it: the URI in the authorize
request is simply not byte-for-byte identical to a registered one.

Print the exact strings this deployment sends:

```bash
curl -s https://unifyos-workflow-engine.vercel.app/api/diagnostics/oauth | jq .
```

The response contains:

| Field | Meaning |
| --- | --- |
| `signIn.redirectUri` | the URI Google must accept for **Sign in with Google** |
| `signIn.clientId` | first 20 chars of the client ID in use — confirm it is the client you edited |
| `appConnections[].redirectUri` | the URI each **Connect** button sends |
| `requiredRegistrations` | deduplicated list to paste into the console |
| `config.originDrift` | `true` when users browse a host other than `APP_URL` / `NEXTAUTH_URL` |

Usual causes, in order of likelihood:

1. **The OAuth client was rotated and the new one has no redirect URI.** A fresh
   *Web application* client starts with an empty list; add the production URI
   from `requiredRegistrations`.
2. **Wrong client.** The URI is registered on a different client than the one in
   `GOOGLE_CLIENT_ID` — compare the prefix printed by the endpoint.
3. **Client type is not "Web application".** Desktop/Android/iOS clients reject
   web redirect URIs outright.
4. **A trailing slash or `http` vs `https`.** Google compares literally.
5. **Editing on the wrong project.** Credentials are per Google Cloud project.

After saving, Google usually propagates within a minute; then retry in a fresh
tab (a stale authorize URL is cached in history, not by the app).

### 4.5 After changing env vars

- [ ] Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel → Settings → Environment Variables (Production).
- [ ] Confirm `GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY=true` for Production (set 2026-10-22).
- [ ] **Redeploy** — Vercel freezes `process.env` at deploy time.
- [ ] Sign out and back in (or use **Reconnect**) so a token with the new scopes is issued.

---

## 5. Verification performed in this change

* `tsc --noEmit` on the frontend: **clean**.
* `next build`: **compiled successfully**, all 11 Google routes emitted as serverless functions.
* Runtime smoke test against a built server with a real signed session cookie:
  * unauthenticated → `401 AUTH_REQUIRED`
  * wrong method → `405 METHOD_NOT_ALLOWED`
  * authenticated but not connected → `409 GOOGLE_NOT_CONNECTED` with `connectUrl`
  * `POST /api/apps/google/connect` → consent URL with `access_type=offline`, `prompt=consent`,
    **12 scopes**, request-derived `redirect_uri`, signed `state`.
* Token lifecycle (20 assertions): valid token skips refresh; expired token refreshes and persists an
  encrypted token + expiry; a rotated refresh token is stored; a missing refresh token, `invalid_grant`,
  corrupt ciphertext and missing credentials each produce the correct typed error and disconnect state.
* OAuth `state` handling (19 assertions): legacy 3-segment states still verify; `returnTo` round-trips;
  tampering, wrong user/app, and `//evil.com` / absolute URLs are all rejected.

---

## 6. Recommendation: consider splitting sign-in from Workspace scopes

As requested, sign-in currently requests all nine Workspace scopes. That has three consequences:

1. Every **login** shows the full consent screen (including the unverified-app warning) — friction for
   users who only want to sign in.
2. It forces Google verification of **restricted** scopes (`gmail.modify`, `drive`, `contacts`) just to
   let people log in.
3. If verification lapses, **login itself** breaks, not just the integrations.

The safer shape — available today with one env var — is:

```bash
GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY=true
```

Sign-in then asks only for `openid email profile`, and Workspace permissions are granted when the user
clicks **Connect** in Settings → Integrations (that flow already exists and stores tokens in `AppToken`,
which is exactly what the helper reads). This keeps the login path simple and lets you ship integrations
independently.

**Decision (2026-10-22): adopted for the initial launch.** `GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY=true` is
set on the Vercel project's Production environment, so sign-in requests only `openid email profile` while
the Connect flow requests the full Workspace scope set.

### Consequences of this setting

| | `=true` (current) | `=false` (full scopes at sign-in) |
| --- | --- | --- |
| Login prompt | Email/profile only — no unverified-app warning for the restricted scopes | Full Workspace consent incl. restricted scopes |
| Unverified-app cap | Applies only to the Connect flow | Applies to **every login** |
| Google verification | Needed only to ship integrations publicly | Needed just to let people sign in |
| Token on first login | No refresh token for Workspace | Refresh token available immediately |
| Workspace access | Requires the user to click **Connect** once | Implicit |

Because sign-in no longer grants Workspace access, a user who wants Drive/Docs/etc. **must** complete
Settings → Integrations → **Connect**. The status route and the cards' disabled "Connect first" state
make that path explicit.

---

## 7. Known limitations

* **Calendar/Drive/Gmail pagination** is not implemented in these test routes (fixed `maxResults`/`pageSize`);
  Drive returns `nextPageToken` so a follow-up page is one parameter away.
* **Drive `files.list` is eventual** for recent changes; `orderBy: 'modifiedTime desc'` is the documented
  best-effort for "recently modified".
* **Contacts** reads `people/me` connections only — Google's "Other contacts" (auto-collected addresses)
  require the separate `otherContacts` endpoint and scope.
* These routes are **read-biased test endpoints**. For production workflows, wire them into the existing
  `Workflow`/`WorkflowExecution` engine rather than calling them from the browser.
