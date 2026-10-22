# OAuth Redirect Fix — Diagnosis, Code Changes, and Whitelist Checklist

Date: 2026-10-22
Scope: authentication and OAuth redirect flow only. **No database schema, SQL trigger, or RLS policy was touched.**

---

## 1. Read this first: the stack in this repo is not Supabase Auth

The task described `supabase.auth.signInWithOAuth(...)`, `app/auth/callback/route.ts`, and
`supabase.auth.exchangeCodeForSession(code)`. **None of those exist in this repository**, and they cannot
fail here because they are never called:

| Assumed by the task | Reality in this repo |
| --- | --- |
| `supabase.auth.signInWithOAuth` | Not present anywhere. Login uses **NextAuth v4** `signIn('google', …)`. |
| `app/auth/callback/route.ts` (App Router) | Does not exist. The app is **Pages Router** (`apps/frontend/pages`). The OAuth callback is the built-in **`/api/auth/callback/google`**. |
| `supabase.auth.exchangeCodeForSession(code)` | Does not exist. NextAuth performs the code exchange internally in `pages/api/auth/[...nextauth].ts`. |
| `@supabase/ssr` | Not a dependency. |
| Supabase Auth session | Supabase is only an **optional read-only data source** (`lib/supabase.ts`, used by 3 API routes) alongside Prisma/Postgres as the auth database. |
| Deployed on Vercel | The repo is configured for **Render** (`render.yaml`, `onrender.com` defaults) and contains no `vercel.json`. |

So the real Google OAuth flow that can break is:

```
/auth/login  ──signIn('google')──▶  accounts.google.com
     │
     └───────────────▶  /api/auth/callback/google  ──▶  NextAuth code exchange  ──▶  session + redirect to callbackUrl
```

If you are in fact migrating this app to **Supabase Auth** (`@supabase/ssr` + App Router), that is a
separate piece of work — say the word and I will scaffold `app/auth/callback/route.ts` with
`exchangeCodeForSession`. The items below fix the OAuth flow that is actually deployed.

---

## 2. Root causes found

Five defects, each independently capable of producing "the Google redirect fails / behaves unexpectedly".

### 2.1 Stale `NEXTAUTH_URL=http://localhost:3000` silently wins in production — **primary cause**

`next-auth@4.24.15` (`utils/detect-origin.js`) returns `NEXTAUTH_URL` **before** it considers the
Vercel/Render host headers:

```js
if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;      // ← localhost wins
if (process.env.VERCEL ?? process.env.AUTH_TRUST_HOST) return `${protocol}://${forwardedHost}`;
return process.env.NEXTAUTH_URL;
```

`.env.example` ships `NEXTAUTH_URL="http://localhost:3000"`. Copying that value into the Vercel project
makes Google receive a **localhost** `redirect_uri`, which produces
`Error 400: redirect_uri_mismatch`, and makes a *successful* login bounce the browser to localhost.

### 2.2 Integration callbacks hardcoded a localhost fallback

`lib/integrations.ts` had:

```ts
getEnv('NEXTAUTH_URL') || getEnv('NEXT_PUBLIC_APP_URL') || `http://localhost:${PORT || '3000'}`
```

With no `NEXTAUTH_URL` on Vercel, every Gmail/Calendar connect link asked Google to redirect to
`http://localhost:3000/api/apps/gmail/callback` → `redirect_uri_mismatch`.

### 2.3 First-time Google sign-in always failed (two separate bugs in `[...nextauth].ts`)

**(a) Duplicate user creation.** The `signIn` callback called `prisma.user.create(...)` for new Google
users. NextAuth runs `signIn` *before* its own `callbackHandler`, which then calls
`adapter.getUserByEmail()` → finds the row the callback just created → has no linked `Account` row →
throws `OAuthAccountNotLinked`. Every first-time Google login failed.

**(b) Schema/adapter mismatch.** NextAuth's Prisma adapter sends
`createUser({ name, email, image, emailVerified: null })`, but the `User` model intentionally has:

* **no `image` column** → Prisma throws `Unknown argument 'image'`
* `emailVerified Boolean @default(false)` (**non-nullable**) → `null` violates NOT NULL

Even with (a) removed, account creation would still have failed.

### 2.4 Missing NextAuth page routes turned every rejection into a 404

`authOptions.pages` pointed at three pages that did not exist:

| Configured | Existed? | Effect |
| --- | --- | --- |
| `/auth/error` | ❌ | Every OAuth error redirected to a **404** — no error code, no explanation |
| `/auth/logout` | ❌ | Sign-out redirect → **404** |
| `/auth/welcome` (`newUser`) | ❌ | First successful OAuth sign-in could land on a **404** |

This is why the redirect looked "broken": the failure was swallowed and replaced with a generic 404.

### 2.5 Relative `callbackUrl` and no error surfacing on the login page

`signIn('google', { callbackUrl })` passed a relative path, so the final destination depended entirely on
the server-side origin from 2.1. Provider errors were never read from `?error=`, so users got no message.

---

## 3. Code changes applied

| File | Change |
| --- | --- |
| `apps/frontend/lib/app-url.ts` **(new)** | One source of truth for the public origin: `APP_URL` → `NEXT_PUBLIC_APP_URL` → `NEXTAUTH_URL` → platform (`VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL`/`RENDER_EXTERNAL_URL`) → request headers → localhost. **Ignores localhost values on hosted platforms.** |
| `apps/frontend/lib/auth-adapter.ts` **(new)** | Wraps `PrismaAdapter` and maps NextAuth's payload onto the existing schema: drops `image`, coerces `emailVerified: Date \| null` → `boolean`, lowercases email, and returns proper `AdapterUser` objects. **No migration needed.** |
| `apps/frontend/pages/api/auth/[...nextauth].ts` | Uses the new adapter; **removed the duplicate `prisma.user.create`**; `NEXTAUTH_URL` is sanitised via `getConfiguredAppUrl()` (and deleted if it is localhost on a hosted platform); Google params relaxed to `prompt=select_account`; `pages` fixed (`/auth/error`, `/auth/logout`, `newUser` removed); `jwt` callback backfills `plan`/`adminRole` for OAuth users; `events.createUser` marks provider-verified accounts verified; optional `AUTH_ALLOW_GOOGLE_EMAIL_LINKING` (default **off**). |
| `apps/frontend/pages/auth/error.tsx` **(new)** | Renders a specific message per NextAuth error code (`OAuthCallback`, `OAuthAccountNotLinked`, `Configuration`, …) instead of a 404. |
| `apps/frontend/pages/auth/logout.tsx` **(new)** | Completes `signOut()` and lands on `/auth/login`. |
| `apps/frontend/pages/auth/login.tsx` | `callbackUrl` is now built from `window.location.origin` (localhost stays localhost, Vercel stays Vercel); reads `?error=` and shows a human-readable message. |
| `apps/frontend/pages/api/apps/[id]/connect.ts` | New exported `getIntegrationRedirectUri(appId, req)`; the authorize URL is built from the **live request origin**. |
| `apps/frontend/pages/api/apps/[id]/callback.ts` | Token exchange uses the **same** `getAppBaseUrl(req)` origin, so `redirect_uri` matches byte-for-byte. |
| `apps/frontend/pages/api/auth/slack/callback.ts` | Redirect URI derives from the request origin. |
| `apps/frontend/lib/integrations.ts` | `getAppBaseUrl` re-exported from `lib/app-url` (no more localhost fallback in production). |
| `apps/frontend/lib/supabase.ts` | Normalises `NEXT_PUBLIC_SUPABASE_URL` (strips trailing `/`, `/rest/v1`, `/auth/v1`, adds `https://`). |
| `.env.example`, `apps/frontend/.env.local.example` | Document `APP_URL`, the correct Supabase origin, Google callback paths, and `AUTH_ALLOW_GOOGLE_EMAIL_LINKING`. |

### Verification performed

* `tsc --noEmit` on the frontend: clean, except one **pre-existing** error caused by `@prisma/client` not
  being generated in this sandbox (`binaries.prisma.sh` is unreachable here). Run `npm run prisma:generate`
  locally to clear it.
* URL resolver: 11/11 scenario assertions pass (local dev, Vercel prod, Vercel preview, Render,
  stale-localhost-on-Vercel, proxy headers, stale `APP_URL` precedence, callback paths).
* Adapter mapping: 12/12 assertions pass against a fake Prisma client using the exact payload NextAuth
  sends for a new Google user.

---

## 4. What you must change outside the code

Replace `YOUR-DOMAIN` with your real Vercel domain below. Nothing else works until these match exactly —
Google compares the URI **including scheme, host, path, and trailing slash**.

Let us assume:

* Production: `https://YOUR-DOMAIN.vercel.app`
* Local: `http://localhost:3000`

### 4.1 Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID

**Authorized JavaScript origins** (scheme + host, no path, no trailing slash):

- [ ] `http://localhost:3000`
- [ ] `https://YOUR-DOMAIN.vercel.app`

**Authorized redirect URIs** (these are the ones that actually matter for this app):

- [ ] `http://localhost:3000/api/auth/callback/google` ← sign-in, local
- [ ] `https://YOUR-DOMAIN.vercel.app/api/auth/callback/google` ← sign-in, production
- [ ] `http://localhost:3000/api/apps/gmail/callback` ← Gmail integration, local
- [ ] `https://YOUR-DOMAIN.vercel.app/api/apps/gmail/callback` ← Gmail integration, production
- [ ] `http://localhost:3000/api/apps/calendar/callback` ← Calendar integration, local
- [ ] `https://YOUR-DOMAIN.vercel.app/api/apps/calendar/callback` ← Calendar integration, production

> Use **`/api/auth/callback/google`**, not `/auth/callback`. This app has no `/auth/callback` route.
> Google does **not** support wildcards, so `https://*.vercel.app/...` will be rejected. For Vercel
> **preview** deployments, either test on the production domain or add the specific preview hostname.
> If you use a custom domain, add it as well and set `APP_URL` to it.

**OAuth consent screen**

- [ ] Publishing status set to **In production** (otherwise only test users can sign in).
- [ ] `openid`, `email`, `profile` are non-sensitive scopes; `gmail.modify` and `calendar` **are**
      sensitive/restricted and require verification for non-test users — that only affects the
      *integration* connect flow, not "Continue with Google" sign-in.

### 4.2 Vercel → Project → Settings → Environment Variables

Set these for **Production** (and Preview, if you test previews):

- [ ] `APP_URL` = `https://YOUR-DOMAIN.vercel.app` (no trailing slash)
- [ ] `NEXTAUTH_URL` = `https://YOUR-DOMAIN.vercel.app` (**must not be localhost**)
- [ ] `NEXTAUTH_SECRET` = a long random string (`openssl rand -base64 32`) — reuse the same value
      across environments, or sessions invalidate on deploy
- [ ] `GOOGLE_CLIENT_ID` = `….apps.googleusercontent.com`
- [ ] `GOOGLE_CLIENT_SECRET` = `GOCSPX-…`
- [ ] `DATABASE_URL` = Supabase **session pooler** URI
      (`postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres`)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://gsuipjnxshrqelmicvyo.supabase.co`
      (bare origin — **no** trailing slash, **no** `/rest/v1`, **no** `/auth/v1`)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = service-role key (server-only; never prefix with `NEXT_PUBLIC_`)
- [ ] `ENCRYPTION_KEY` = 64 hex chars (`openssl rand -hex 32`) if any integration is enabled
- [ ] `AUTH_ALLOW_GOOGLE_EMAIL_LINKING` = leave unset/`false` unless you want Google to auto-link to
      existing password accounts with the same email

Then **redeploy** — Vercel bakes `process.env` at build/run start, so existing deployments keep the old
value.

> Setting `NEXTAUTH_URL` is technically optional now that the code ignores a localhost value on hosted
> platforms, but setting it explicitly keeps preview and production predictable.
> For **preview** deployments, a fixed production `APP_URL` means callbacks return to production; omit
> `APP_URL`/`NEXTAUTH_URL` in the Preview environment to let Vercel's deployment URL be used.

### 4.3 Supabase Dashboard (project `gsuipjnxshrqelmicvyo`)

These entries only affect **Supabase Auth**. This app currently authenticates through NextAuth, so they
are informational unless/until you move to Supabase Auth — but they are harmless to configure and are
required the moment you switch.

**Authentication → URL Configuration**

- [ ] **Site URL**: `https://YOUR-DOMAIN.vercel.app`
- [ ] **Redirect URLs** (add each):
  - [ ] `http://localhost:3000/**`
  - [ ] `https://YOUR-DOMAIN.vercel.app/**`
  - [ ] `https://*-YOUR-VERCEL-SCOPE.vercel.app/**` (only if you test preview deployments)

**Authentication → Providers → Google**

- [ ] Enabled, with the same Client ID / Secret as above.
- [ ] The **Callback URL (for OAuth)** shown there is
      `https://gsuipjnxshrqelmicvyo.supabase.co/auth/v1/callback`.
      If you enable Supabase Auth, that exact URL must also be added to Google's
      **Authorized redirect URIs**. It is **not** needed for the current NextAuth flow.

**Project Settings → API**

- [ ] Project URL reads `https://gsuipjnxshrqelmicvyo.supabase.co` — this is the exact value for
      `NEXT_PUBLIC_SUPABASE_URL`.

### 4.4 Local development

- [ ] Copy `apps/frontend/.env.local.example` to `apps/frontend/.env.local`.
- [ ] Set `APP_URL=http://localhost:3000`, `NEXTAUTH_URL=http://localhost:3000`.
- [ ] Use the **same** Google client ID/secret as production (both redirect URIs are registered), or a
      second client — either is fine, but the URIs must match per client.
- [ ] Run the app on **port 3000**; port 3001 will not match a redirect URI ending in `:3000`.

---

## 5. How to verify

1. `npm run dev`, open `http://localhost:3000` → you are redirected to `/auth/login?callbackUrl=%2F`.
2. Click **Continue with Google**. In the Google consent URL, confirm
   `redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgoogle`.
3. After consent you should land on `/` with a session; `http://localhost:3000/api/auth/session` returns
   the user with `id`, `plan`, `adminRole`.
4. Repeat on Vercel; the consent URL must contain
   `redirect_uri=https%3A%2F%2FYOUR-DOMAIN.vercel.app%2Fapi%2Fauth%2Fcallback%2Fgoogle`.
5. Confirm a **new** Google account is created once in `User` and linked once in `Account`
   (`SELECT provider, provider_account_id FROM "Account"`).
6. Sign out → you should land on `/auth/login`, not a 404.

### Error → cause map

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Error 400: redirect_uri_mismatch` | URI in Google console ≠ URI sent by app | §4.1 + §4.2 (`APP_URL`/`NEXTAUTH_URL`) |
| Login works, then lands on `localhost:3000`/dead page | Stale `NEXTAUTH_URL` on Vercel | §4.2; code now ignores it, but set it correctly |
| `/auth/error?error=OAuthAccountNotLinked` | Email already exists as a password account | Sign in with password, or set `AUTH_ALLOW_GOOGLE_EMAIL_LINKING=true` |
| `/auth/error?error=Configuration` | Missing/invalid `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` | §4.2 |
| `/auth/error?error=OAuthCreateAccount` | Adapter/schema mismatch | Fixed by `lib/auth-adapter.ts` |
| 404 at `/auth/error` or `/auth/logout` | Pages were missing | Fixed by the two new pages |
| Signed in but `plan`/`adminRole` undefined | OAuth users bypass the credentials path | Fixed by the `jwt` callback backfill |

---

## 6. Related hardcoded-host issues — now fixed

* `apps/frontend/pages/api/billing/initialize.ts` — the Paystack `callback_url` used
  `getEnv('NEXTAUTH_URL') || 'http://localhost:3000'`. **Fixed:** now `getAppBaseUrl(req)`, so a paying
  customer is returned to the origin they are actually on.
* `apps/frontend/lib/email.ts` — welcome email linked to
  `https://unifyos-platform.onrender.com/dashboard`. **Fixed:** the template receives
  `${getAppBaseUrl()}/` and resolves per environment.
* `apps/frontend/pages/api/contact/support.ts` — same dead host in two places (the "View in Admin Panel"
  button and the footer). **Fixed:** both now use `getAppBaseUrl(req)`.

### Still outstanding

* Two Slack callbacks exist (`/api/apps/slack/callback` and `/api/auth/slack/callback`). The connect flow
  uses `/api/apps/slack/callback`; the other is dead code that can be removed.
* `apps/frontend/pages/apps.tsx` is a 10-line stub, so the integration connect UI still needs building —
  the API contract (`POST /api/apps/:id/connect` → `{ authUrl }`, then redirect) is ready.

---

## 7. Vercel environment audit (verified via the Vercel API)

Project: **`unifyos-workflow-engine`** (`prj_bQikEREbuudJh7Fn6x0kAJFc6QjJ`), team
`team_doQ36GvdeTLGgUo8AP0e5Pwi`
Production domain: **`https://unifyos-workflow-engine.vercel.app`** (verified, only custom domain attached)
Root directory: `apps/frontend` · Framework: Next.js · Install/build: `cd ../.. && npm …`

| Variable | State found | Action |
| --- | --- | --- |
| `NEXTAUTH_URL` | `https://unifyos-workflow-engine.vercel.app` | ✅ already correct — **no localhost value present** |
| `APP_URL` | **missing** | ➕ created (`https://unifyos-workflow-engine.vercel.app`, production) |
| `NEXTAUTH_SECRET` | present (sensitive) | ✅ left untouched — not decrypted, since it is a secret |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gsuipjnxshrqelmicvyo.supabase.co` | ✅ already the bare origin — no `/rest/v1`, no trailing slash |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | present | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | present (sensitive) | ✅ |
| `DATABASE_URL` | present (sensitive), documented as the Supabase session pooler | ✅ |
| `NOTION_REDIRECT_URI` | `…/api/apps/notion/callback` | ✅ |
| `SLACK_CLIENT_ID` / `SECRET` / `SIGNING_SECRET` | present | ✅ |
| `ENCRYPTION_KEY` | present (sensitive) | ✅ |
| **`GOOGLE_CLIENT_ID`** | **absent** | ❌ **add required** |
| **`GOOGLE_CLIENT_SECRET`** | **absent** | ❌ **add required** |

### Why Google sign-in cannot work in production yet

No `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` exist on the project, and there are no team-level shared
variables either. In `[...nextauth].ts` the Google provider is only registered when **both** are present:

```ts
...(googleClientId && googleClientSecret ? [GoogleProvider({ … })] : [])
```

So on the deployed app `/api/auth/providers` returns no `google` entry, the login page's
`googleAvailable` check fails, and the **"Continue with Google" button never renders**. Gmail and Google
Calendar are equally unconfigured (`getIntegrationStatus` reports the two missing keys). Those two values
can only come from your Google Cloud Console → Credentials → OAuth 2.0 Client ID; they cannot be
generated.

### Environment scoping note

Every variable on this project targets **`production` only** — there are no `preview` or `development`
values. Preview deployments (such as the one built for this branch) therefore have no `DATABASE_URL`,
`NEXTAUTH_SECRET`, or Google credentials, and cannot exercise Google login. Note that adding a fixed
production `APP_URL`/`NEXTAUTH_URL` to the *preview* environment would be wrong: preview OAuth callbacks
would then bounce to the production domain. Either keep preview unscoped and test on the production
domain, or add per-branch `git_branch`-scoped values.

### Credentials for Google Cloud Console to whitelist (production value confirmed)

- [ ] `https://unifyos-workflow-engine.vercel.app/api/auth/callback/google`
- [ ] `https://unifyos-workflow-engine.vercel.app/api/apps/gmail/callback`
- [ ] `https://unifyos-workflow-engine.vercel.app/api/apps/calendar/callback`
- [ ] Authorized JavaScript origin: `https://unifyos-workflow-engine.vercel.app`

Notion is already registered at `…/api/apps/notion/callback` and Slack at `…/api/apps/slack/callback`.
