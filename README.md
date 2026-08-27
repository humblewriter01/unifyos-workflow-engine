# UnifyOS Workflow Engine

UnifyOS is a workflow automation platform for connecting productivity tools, viewing notifications, managing automations, and monitoring productivity metrics from one dashboard.

## Features

The application includes a unified inbox, workflow management, an integration catalog, analytics, password authentication, optional email delivery, and OAuth activation for configured providers. The application is designed to start safely when optional provider credentials have not yet been supplied.

## Technology

The frontend is a Next.js 14 application with TypeScript, React, Tailwind CSS, and NextAuth.js. Authentication data is stored in PostgreSQL through Prisma. Dashboard and integration-token data uses the optional Supabase service. Production deployment is configured for Render using the Next.js standalone server.

## Local setup

Install dependencies from the repository root so the workspace lockfile is respected:

```bash
npm ci
npm run build
```

Copy `.env.example` to the environment file used by your local process and set the core authentication values. `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` are core settings. Supabase, Resend, and provider credentials are optional.

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
| Supabase dashboard data | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Apps, workflows, notifications, and analytics remain loadable with empty-state responses |
| Email and support | `RESEND_API_KEY`, `SUPPORT_EMAIL` | Credentials login remains available; verification, password reset, and support delivery report that email is not configured |
| OAuth token storage | `ENCRYPTION_KEY` | Provider connection is disabled until a 32-byte hexadecimal key is supplied |
| Email verification | `REQUIRE_EMAIL_VERIFICATION=true`, `RESEND_API_KEY` | When false or omitted, credentials accounts can sign in without email delivery; when true, verification is enforced |

## Activating integrations later

Add the complete credential set for a provider to Render, redeploy, and confirm its status through `/api/health` or `/api/apps`. The app catalog marks providers as `configured` only when all required values are present. A provider without credentials is displayed as `Setup required` and cannot be connected accidentally.

| Integration | Environment variables |
| --- | --- |
| Google Gmail and Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Notion | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Asana | `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Monday.com | `MONDAY_CLIENT_ID`, `MONDAY_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| HubSpot | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Salesforce | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Trello | `TRELLO_API_KEY`, `TRELLO_API_SECRET` |

Configured providers with implemented OAuth endpoints use the connection flow under `/api/apps/:id/connect` and `/api/apps/:id/callback`. Trello is kept in the catalog for later activation but still requires its provider-specific OAuth exchange to be added before it can connect.

## Verification commands

```bash
npm ci
npm run build
npm run prisma:generate
npm run prisma:migrate
```

Apply `npm run prisma:migrate` only after `DATABASE_URL` points to the intended database. Render runs the same command automatically as its pre-deploy step.

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
