# UnifyOS Workflow Engine

UnifyOS is a workflow automation platform for connecting productivity tools, viewing notifications, managing automations, and monitoring productivity metrics from one dashboard.

## Features

The application includes a unified inbox, workflow management, an integration catalog, analytics, password authentication, optional email delivery, and OAuth activation for configured providers. The application is designed to start safely when optional provider credentials have not yet been supplied.

## Technology

The frontend is a Next.js 14 application with TypeScript, React, Tailwind CSS, and NextAuth.js. Authentication, user-owned workflows, and encrypted integration tokens are stored in PostgreSQL through Prisma. Supabase is optional dashboard data only. Production deployment is configured for Render using the Next.js standalone server.

## Local setup

Install dependencies from the repository root so the workspace lockfile is respected:

```bash
npm ci
npm run build
```

Copy `.env.example` to the environment file used by your local process and set the core authentication values. `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` are core settings. Supabase, Resend, and provider credentials are optional. For Render with Supabase, set `DATABASE_URL` to the Supabase **Session pooler** URI from Connect, using the `aws-*.pooler.supabase.com` host and port `5432`; the direct `db.<project-ref>.supabase.co:5432` endpoint can be IPv6-only.

To run the application locally after building:

```bash
npm start
```

The application is available at `http://localhost:3000` unless `PORT` is set.

## Render deployment

The checked-in `render.yaml` performs the following steps from the repository root:

```text
npm ci
npm run build
copy Next.js standalone static assets
run `npm run prisma:migrate` as the pre-deploy command
start apps/frontend/.next/standalone/apps/frontend/server.js
```

The build script generates the Prisma client before compiling Next.js, and the pre-deploy command applies the checked-in Prisma migration for password and NextAuth session tables. Render uses `/api/health` as its health check. Do not use `next start` with the standalone output because Next.js reports that combination as unsupported.

## Environment configuration

Only the following values are required for the authentication portion of the application:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection used by Prisma and NextAuth |
| `NEXTAUTH_URL` | Yes in production | Public application URL, including the Render URL |
| `NEXTAUTH_SECRET` | Yes | Session and OAuth-state signing secret |
| `NODE_ENV` | Recommended | Set to `production` on Render |

The following services are optional. If they are omitted, the application still starts and read-only dashboard endpoints return safe empty states with a degraded metadata flag.

| Service | Variables | Behavior when omitted |
| --- | --- | --- |
| Supabase dashboard data | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional supplemental dashboard data remains loadable with empty-state responses |
| Email and support | `RESEND_API_KEY`, `SUPPORT_EMAIL` | Credentials login remains available; verification, password reset, and support delivery report that email is not configured |
| OAuth token storage | `ENCRYPTION_KEY` | Provider connection is disabled until a 32-byte hexadecimal key is supplied |
| Email verification | `REQUIRE_EMAIL_VERIFICATION=true`, `RESEND_API_KEY` | When false or omitted, credentials accounts can sign in without email delivery; when true, verification is enforced |
| Authenticator-app 2FA | No extra environment variable; requires `NEXTAUTH_SECRET` and `DATABASE_URL` | Users can set up TOTP, receive one-time recovery codes, and use either a TOTP or recovery code at login |

## Activating integrations later

Add the complete credential set for a provider to Render, redeploy, and confirm its status through `/api/health` or `/api/apps`. The app catalog marks providers as `configured` only when all required values are present. A provider without credentials is displayed as `Setup required` and cannot be connected accidentally.

| Integration | Environment variables |
| --- | --- |
| Google Gmail and Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `ENCRYPTION_KEY` (`SLACK_SIGNING_SECRET` for Events API) |
| Notion | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`, `ENCRYPTION_KEY` |
| Asana | `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Monday.com | `MONDAY_CLIENT_ID`, `MONDAY_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| HubSpot | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Salesforce | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Trello | `TRELLO_API_KEY`, `TRELLO_API_SECRET` |

Configured providers with implemented OAuth endpoints use the connection flow under `/api/apps/:id/connect` and `/api/apps/:id/callback`. Slack supports channel discovery, message posting, and signed Events API acknowledgements. Notion supports workspace search and page creation; the parent page or database is supplied by the user rather than hardcoded. The exact Notion redirect URI must be registered in the Notion developer portal and set as `NOTION_REDIRECT_URI`. Trello remains in the catalog for later activation but still requires its provider-specific OAuth exchange before it can connect.

## Integration API routes

After a user connects a provider, server-side actions include `GET /api/integrations/slack/channels`, `POST /api/integrations/slack/message`, `POST /api/integrations/notion/search`, and `POST /api/integrations/notion/pages`. Provider tokens are decrypted only on the server and are never returned in API responses. Configure Slack’s Events API Request URL as `https://your-app.onrender.com/api/integrations/slack/events`; Slack requests are accepted only when the signing secret and timestamp signature are valid.

## Two-factor authentication

Users can enable authenticator-app 2FA from **Settings → Security**. Setup generates a QR code and manual key, activation requires a valid six-digit TOTP, and recovery codes are displayed only once. Login accepts a current TOTP or a one-time recovery code. Disabling 2FA requires a current TOTP or recovery code. TOTP secrets are encrypted with `NEXTAUTH_SECRET`, and recovery codes are stored as bcrypt hashes.

## Verification commands

```bash
npm ci
npm run build
npm run prisma:generate
npm run prisma:migrate
```

Apply `npm run prisma:migrate` only after `DATABASE_URL` points to the intended database. Render runs the same command automatically as its pre-deploy step. `/api/health` now returns HTTP 503 with `database: "unavailable"` when the configured database cannot be reached, which makes the deployment failure visible instead of reporting a false healthy state.

For a running local server, verify:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/apps
curl http://localhost:3000/api/workflows
curl http://localhost:3000/api/analytics/stats
curl http://localhost:3000/api/notifications
```

## License

This project is licensed under the MIT License.
