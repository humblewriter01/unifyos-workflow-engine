# UI/UX + Admin Panel — Implementation Plan

**Status: PROPOSED — awaiting approval. No code written yet.**
**Baseline:** `main` @ `c6d46a2`. Two independent PRs, each shippable on its own.

---

## 0. Hard invariants (both PRs)

These files and behaviours will **not** be modified. If any task appears to
need a change here, I will stop and ask instead.

| Protected | Why |
|---|---|
| `pages/api/auth/[...nextauth].ts` | Sign-in, JWT/session callbacks, `prompt=select_account` |
| `lib/auth-adapter.ts`, `types/next-auth.d.ts` | Prisma adapter contract |
| `lib/google-auth.ts`, `lib/google.ts`, `lib/google-scopes.ts`, `lib/google-services.ts`, `lib/google-route.ts` | The Workspace suite |
| `pages/api/integrations/google/**` (11 routes) | Workspace feature contracts |
| `pages/api/apps/[id]/{connect,callback}.ts`, `lib/oauth.ts` | OAuth + token encryption |
| `apps/api/prisma/schema.prisma`, migrations, SQL triggers, RLS | No schema changes — your standing constraint |

**PR 1 touches zero backend files.** It is pages, components, styles and the
Tailwind config only. That is a deliberate risk boundary: a UI PR physically
cannot regress authentication or the Google integration.

---

# PR 1 — UI/UX Modernisation (dashboard, integrations, workflow cards)

## 1.1 Problems in the current UI (all verified in source)

| # | Issue | Evidence |
|---|---|---|
| 1 | **No component system.** Buttons, cards, inputs, badges are copy-pasted with slightly different classes on every page | `index.tsx`, `WorkflowsList.tsx`, `settings/integrations.tsx` (425 lines in one file) |
| 2 | **Two competing palettes.** `tailwind.config.js` defines `neutral-*` + `dark-*`; the pages use `gray-*` | `index.tsx:29`, `DashboardLayout.tsx:28`, `Header.tsx:20` |
| 3 | **Header search is fake and has a mobile text bug.** No handler, and `text-transparent` on mobile makes typed text invisible | `Header.tsx:44` |
| 4 | **Hardcoded "No apps" status pill** in the header, forever | `Header.tsx:52` |
| 5 | **Sidebar has no Settings, no Integrations, no Admin link**, and no user block | `Sidebar.tsx:6-13` |
| 6 | Components declared *inside* render bodies (`StatCard`, `EmptyState`), so they remount every render and can't be memoised | `index.tsx:41,66` |
| 7 | `any` typing on dashboard cards | `index.tsx:40` |
| 8 | `h-screen` + `overflow-hidden` breaks on iOS Safari (URL bar) and ignores safe-area insets | `DashboardLayout.tsx:35` |
| 9 | Tables/lists don't reflow — horizontal scroll on mobile | `WorkflowsList.tsx`, `pages/admin/index.tsx` |
| 10 | Only `/settings/integrations` is reachable; `profile`/`account`/`security` have no shared sub-nav | `pages/settings/*` |

## 1.2 Design system — new `components/ui/`

Eleven primitives, each ≤120 lines, all keyboard accessible, all dark-mode
aware, all using semantic tokens (no raw `gray-*`).

```
components/ui/Button.tsx      variant: primary|secondary|outline|ghost|danger
                              size: sm|md|lg · loading · iconLeft · fullWidth
components/ui/Card.tsx        Card · CardHeader · CardTitle · CardDescription
                              CardContent · CardFooter
components/ui/Badge.tsx       tone: neutral|success|warning|danger|info|brand
components/ui/Field.tsx       Label + Input/Select/Textarea + hint + error
                              (wires id / aria-invalid / aria-describedby)
components/ui/Skeleton.tsx    shimmer block; respects prefers-reduced-motion
components/ui/EmptyState.tsx  icon · title · description · action
components/ui/Alert.tsx       tone variants; role="status" vs role="alert"
components/ui/Modal.tsx       portal, focus trap, Escape, scroll lock,
                              aria-modal; becomes a bottom sheet < sm
components/ui/Dropdown.tsx    menu button for card kebab + avatar; roving focus
components/ui/StatCard.tsx    label · value · delta · icon · loading
components/ui/PageHeader.tsx  breadcrumb · title · description · actions slot
```

Plus two structural pieces:

```
components/ui/DataTable.tsx   ONE column config → <table> on md+ and stacked
                              cards on mobile. Loading / empty / error states.
components/ui/Toast.tsx       ToastProvider + useToast(); replaces the inline
                              message strings on the integrations page.
```

### Token changes (`tailwind.config.js`)

Adds semantic aliases on top of the existing palette so pages stop hardcoding
colour pairs, and a `focusRing` token so focus states are consistent:

```js
colors: {
  surface:        { DEFAULT: '#ffffff', muted: '#fafafa',  /* dark: */ },
  'surface-dark': { DEFAULT: '#0f1419', muted: '#171923' },
  'content':      { DEFAULT: '#171717', secondary: '#525252', muted: '#737373' },
  'border-subtle':'#e5e5e5',
}
```

Existing `primary` / `accent` / `neutral` / `dark` keys are **kept unchanged**
so nothing that already works breaks.

## 1.3 Layout shell

**`components/layout/DashboardLayout.tsx`**
- `h-screen` → `min-h-[100dvh]`; add `pb-[env(safe-area-inset-bottom)]`.
- Skip-link to `#main`.
- Wrap children in `<main id="main" tabIndex={-1}>`.
- Keep the existing `useSession` redirect logic **byte-for-byte**; only markup
  changes. (This is the one auth-adjacent file, so: no logic edits.)

**`components/layout/Sidebar.tsx`**
- Grouped nav: **Main** (Dashboard, Inbox, Workflows, Connections, Analytics) ·
  **Account** (Billing, Settings, Integrations) · **Admin** (only when
  `session.user.adminRole` is set and not `NONE`).
- `aria-current="page"`, 44px min tap target, active accent bar.
- Footer becomes a user card (avatar, email, plan badge, menu) replacing the
  "Need help?" box.
- Keyboard: Escape closes mobile drawer; background marked `aria-hidden` while
  open.

**`components/layout/Header.tsx`**
- Delete the fake search input, or wire it to `/workflows?q=` (decision needed —
  see §4). I recommend wiring it, since workflows already support filtering
  client-side.
- Replace hardcoded "No apps" with the real count from `/api/apps`
  (the endpoint already returns `meta.connected`).
- Add breadcrumb + notification bell with unread count (from the existing
  `/api/notifications`), keep the theme toggle and sign-out exactly as they are.

## 1.4 Page-by-page

**Dashboard — `pages/index.tsx` (241 lines → composed)**
```
pages/index.tsx                        orchestrator only (~60 lines)
components/dashboard/DashboardStats.tsx     4 × StatCard from /api/analytics/stats
components/dashboard/GettingStarted.tsx     checklist: connect an app → build a
                                            workflow → see a run (derived from
                                            existing data, no new endpoint)
components/dashboard/RecentActivity.tsx     notifications feed
components/dashboard/QuickActions.tsx       New workflow · Connect app · Inbox
```
Deletes the inline `StatCard`/`EmptyState`, replaces `any` with `AnalyticsData`.

**Workflows — `components/WorkflowsList.tsx` (231 lines → 3 files)**
```
components/workflows/WorkflowToolbar.tsx  search, status filter, sort, New
components/workflows/WorkflowCard.tsx     name · enabled toggle · trigger →
                                          action chain · last run · run count ·
                                          kebab (edit/duplicate/delete)
components/workflows/WorkflowList.tsx     grid on lg, stack on mobile; skeleton
                                          and empty states
```
Card is the priority: today a workflow's trigger/action summary is buried in a
dense row. New layout puts `triggerApp → action[0] → +N` on its own line with a
status pill.

**Integrations — `pages/settings/integrations.tsx` (425 lines → 5 files)**
```
pages/settings/integrations.tsx              layout + data fetching only
components/integrations/ConnectionPanel.tsx  Google status, Connect/Reconnect/
                                             Disconnect, granted-scope chips
components/integrations/IntegrationCard.tsx  one per service, Connect/Test
components/integrations/ScopeChips.tsx       granted vs missing scopes
components/integrations/TestResult.tsx       last test output, typed errors
```
**Contract frozen:** same 11 endpoints, same request bodies, same response
shapes (`{connected, missingScopes, connectUrl}`, `GOOGLE_NOT_CONNECTED`, …).
The refactor is mechanical: move JSX out, keep every `fetch` call identical.

**Connections — `pages/apps.tsx` (10 lines → catalog page)**
Uses the existing `/api/apps` shape (`configured`, `connected`, `category`) to
render a filterable grid of `IntegrationCard`s with "Configured" /
"Needs setup" / "Connected" badges. This is where §6.1 of the audit (Gmail vs
Google duplication) becomes visible, so I will show Gmail/Calendar as *"included
in Google Workspace"* rather than as separate Connect buttons.

**Settings — `components/settings/SettingsLayout.tsx`**
Shared sub-nav across `profile`, `account`, `security`, `integrations`.

## 1.5 Responsive & accessibility acceptance criteria

- 320px → no horizontal scroll on any page (test at 320/375/414/768/1024/1440).
- Tap targets ≥ 44×44; body text ≥ 14px; contrast ≥ 4.5:1 in both themes.
- Full keyboard path: skip link → sidebar → header → content; visible focus ring
  everywhere; `Escape` closes overlays and returns focus to the trigger.
- `aria-current`, `aria-expanded`, `aria-invalid`, `aria-live` on async results.
- `prefers-reduced-motion` disables the slide/shimmer animations.
- Works at 200% browser zoom.

## 1.6 Verification

`tsc --noEmit` → 0 · `next build` → 0 · route count unchanged (24 pages,
11 Google routes) · bundle delta reported · manual 320px pass · axe/Lighthouse
pass on `/`, `/workflows`, `/apps`, `/settings/integrations`.

**Effort:** ~2–3 focused sessions. Risk: **low** (presentational only).

---

# PR 2 — Admin Panel

## 2.1 What already exists (important)

An admin area **already ships**, and I will extend it rather than build a
parallel one:

```
pages/admin/index.tsx            41 lines, single-line JSX, everything crammed
                                 into one return: metrics, plan creation,
                                 catalog, users, audit
pages/api/admin/overview.ts      counts + last 25 audit rows
pages/api/admin/users/index.ts   user list
pages/api/admin/users/[id].ts    PATCH role / plan
pages/api/admin/plans/*          create + update price plans (leave untouched)
lib/admin-auth.ts                requireAdmin() — session → DB role → MFA gate
```

Two security gaps to close first:

1. **`/admin` is not in `middleware.ts`'s matcher.** The page is only guarded by
   a client-side `useSession` check in `DashboardLayout`, so any signed-in user
   can load the admin shell. The *APIs* correctly 403, so no data leaks today —
   but the page should not be reachable at all.
2. **The page hard-blocks every role except `SUPER_ADMIN`**, while the API
   accepts `SUPPORT_READONLY`, `BILLING_ADMIN`, `CATALOG_ADMIN` too. Billing and
   catalog admins are locked out of a page they are authorised for.

## 2.2 ⚠ Blocking decision: there is no `ADMIN` role

You asked for "restricted to `ADMIN` role". The enum is:

```prisma
enum AdminRole { NONE  SUPPORT_READONLY  BILLING_ADMIN  CATALOG_ADMIN  SUPER_ADMIN }
```

There is **no `ADMIN`**, and adding one means a schema migration — which you
forbade. Three ways forward:

| Option | What it means | Schema change |
|---|---|---|
| **A (recommended)** | Treat **`SUPER_ADMIN`** as "ADMIN". Keep the existing enum, fix the page so it respects all four admin roles with a capability matrix. | none |
| B | App-level alias: `isAdminRole()` also accepts the string `'ADMIN'` — but nothing can ever *store* it, so it is dead code unless/until a migration happens. Confusing. | none |
| C | Add `ADMIN` to the enum via migration | **violates your constraint** |

**I need you to pick A or C before I write PR 2.** I will proceed with **A**
unless told otherwise, and document it as "the app's admin role is
`SUPER_ADMIN`".

Second decision: `requireAdmin()` currently returns **403 `ADMIN_MFA_REQUIRED`**
when the admin has not enabled TOTP. That is good security but means a
freshly-promoted `SUPER_ADMIN` sees an empty panel. I propose keeping the gate
and making the UI explain it with a direct link to `/settings/security`.

## 2.3 Security model — three layers

1. **Edge (`middleware.ts`)** — add `/admin/:path*` to the matcher and check the
   JWT claim that already exists (`token.adminRole`, set in the `jwt` callback).
   No DB call at the edge. Redirect non-admins to `/`.
2. **Server (source of truth)** — every `/api/admin/*` route keeps calling
   `requireAdmin()`, which re-reads the role **from the database** and enforces
   MFA. A revoked role takes effect on the next request.
3. **Client** — `AdminGuard` renders a friendly 403 / MFA-required screen. Never
   the only control.

Plus: `writeAdminAudit()` on every mutation (already exists, currently only used
by plan/user updates — I'll extend it to every write).

## 2.4 Metrics (no schema change; existing indexes only)

All from Prisma on existing models:

```
users        total · new in 7d · verified % · MFA % · by plan
workflows    total · enabled · avg actions per workflow
executions   total · 24h · 7d · by status · success rate · avg + p95 duration
integrations connected AppTokens grouped by appName
billing      active subscriptions by status · successful payments (minor units)
audit        last 25 entries
```

`WorkflowExecution` already has `@@index([status])` and `@@index([startedAt])`,
so the filters are index-backed. **Known limitation:** executions have no
`userId` column and no `@@index([startedAt, status])`. Filtering by user must go
through `workflow.userId` (which is indexed) — correct but a join. Cursor
pagination on `(startedAt, id)` avoids deep offsets. I will report query timings
rather than assume they are fast.

## 2.5 API changes

| File | Type | Purpose |
|---|---|---|
| `pages/api/admin/metrics.ts` | **new** | the metric block above, one round trip |
| `pages/api/admin/executions/index.ts` | **new** | paginated global list — filters: `status`, `workflowId`, `userId`, `from`, `to`, `q`; joins workflow + user email |
| `pages/api/admin/executions/[id].ts` | **new** | full `triggerData`, `results`, `error`, duration |
| `pages/api/admin/errors.ts` | **new** | recent `FAILED` / `CANCELLED` executions + `AuditLog` |
| `pages/api/admin/users/index.ts` | **extend** | `q`, `role`, `plan`, `sort`, `cursor`; adds per-user workflow/execution counts. Existing fields kept. |
| `pages/api/admin/users/[id].ts` | **extend** | add `GET` detail (workflows, recent executions, tokens, audit trail); `PATCH` unchanged + audit entry |
| `pages/api/admin/overview.ts` | **extend** | keep the current response shape (the old page may still call it), add the new fields |
| `lib/admin-auth.ts` | **extend** | `isAdminRole()`, capability matrix, `withAdmin()` wrapper, typed error codes |
| `middleware.ts` | **modify** | add `/admin/:path*` + role claim check |

Answers use the existing envelope (`{success, data, error:{code,message}}`) so
the frontend error handling stays uniform. Every route returns `405` with
`Allow` for wrong methods, matching the rest of the codebase.

## 2.6 UI

```
pages/admin/index.tsx             Overview: 8 metric cards, executions 7d
                                  sparkline, provider mix, recent audit
pages/admin/users.tsx             searchable/filterable table, role + plan
                                  editors, cursor pagination
pages/admin/users/[id].tsx        drilldown: profile, workflows, recent
                                  executions, granted scopes, audit trail
pages/admin/executions.tsx        global execution log, status tabs, date range,
                                  row → detail drawer
pages/admin/errors.tsx            FAILED executions + audit errors

components/admin/AdminLayout.tsx  secondary nav, role badge, MFA banner
components/admin/AdminGuard.tsx  403 / MFA / loading states
components/admin/MetricCard.tsx
components/admin/UsersTable.tsx
components/admin/ExecutionsTable.tsx
components/admin/StatusPill.tsx
components/admin/Pagination.tsx
```

Reuses PR 1's `Card`, `Badge`, `DataTable`, `Dropdown`, `Field` — which is why
**PR 1 must merge first**. Admin uses the same `DataTable`, so the users and
executions tables are responsive on mobile for free.

Destructive actions (role change to/from `SUPER_ADMIN`) get a confirm dialog
naming the user, plus an audit entry written before the response returns.

## 2.7 Verification

- `tsc` + `next build` clean.
- **Unauthenticated** `GET /api/admin/{metrics,executions,errors,users}` → `401`,
  never `200`. Verified with `curl` against the preview, same technique used for
  the Google routes.
- `/admin` while signed out → redirect to sign-in (middleware), not a flash of
  the shell.
- 320px layout pass on the users table.
- I **cannot** verify the authenticated admin flows in this sandbox (no database,
  no login — the Prisma engine download is blocked here). Those need a manual
  pass by you with a `SUPER_ADMIN` + MFA account.

**Effort:** ~3–4 focused sessions. Risk: **medium** (new queries + security
surface, but additive — no existing route changes behaviour).

---

## 3. Sequencing

```
PR 1 (UI foundation)  ──►  merge  ──►  PR 2 (admin) reuses components/ui/*
```
PR 1 first is not cosmetic: it creates `DataTable`, `Badge`, `Dropdown` and the
token layer that PR 2 depends on. Doing them in parallel would duplicate them.

Neither PR touches the auth/Prisma/Google surface, so both are independent of
the recently merged work.

## 4. Questions I need answered

1. **Admin role (§2.2):** option **A** (SUPER_ADMIN *is* the admin role, no
   migration) or **C** (add `ADMIN` via migration, relaxing your constraint)?
2. **Header search:** wire it to workflow filtering, or remove it? (It currently
   does nothing and its mobile text is invisible.)
3. **Scope:** PR 1 as described is ~20 new files. Prefer that full pass, or a
   slimmer version (design system + dashboard + integrations only, deferring
   `/apps` and workflow cards)?
4. **Gmail/Calendar cards (audit §6.1):** fold them into Google Workspace in
   PR 1, or leave the duplicate Connect buttons for a separate fix?
