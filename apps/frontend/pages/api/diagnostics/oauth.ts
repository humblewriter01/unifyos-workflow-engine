import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppBaseUrl, getConfiguredAppUrl, getRequestOrigin } from '../../../lib/app-url';
import { getEnv } from '../../../lib/env';
import { getIntegrationRedirectUri } from '../apps/[id]/connect';

/**
 * OAuth redirect-URI diagnostics.
 *
 * `Error 400: redirect_uri_mismatch` from Google/Notion/Slack is never a
 * runtime failure: the provider compares the `redirect_uri` in the authorize
 * request against the values registered in its console and refuses when they
 * are not **byte-for-byte** identical. This endpoint prints the exact strings
 * this deployment sends, so they can be copied into the provider console
 * instead of guessed.
 *
 * Nothing secret is returned: every value here is already visible in the
 * browser's address bar while signing in. The client ID is masked to the head
 * and tail — enough to tell *which* client is in use, not enough to reuse.
 *
 *   GET /api/diagnostics/oauth
 */

/** Connectable apps, in the order `pages/api/apps/[id]/connect.ts` handles them. */
const CONNECT_APPS = [
  { id: 'google', name: 'Google Workspace', provider: 'Google Cloud Console' },
  { id: 'slack', name: 'Slack', provider: 'Slack app (OAuth & Permissions)' },
  { id: 'notion', name: 'Notion', provider: 'Notion integration' },
  { id: 'asana', name: 'Asana', provider: 'Asana app console' },
  { id: 'hubspot', name: 'HubSpot', provider: 'HubSpot app settings' },
  { id: 'salesforce', name: 'Salesforce', provider: 'Salesforce connected app' },
  { id: 'monday', name: 'Monday.com', provider: 'Monday app console' },
] as const;

/**
 * Client IDs are not secrets (they are in the address bar during sign-in), but
 * this endpoint is public, so only the project-number prefix — the part that
 * identifies *which* client you are looking at in the console — is exposed.
 */
function maskClientId(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 20) return `${value.slice(0, 6)}…`;
  return `${value.slice(0, 20)}…`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  res.setHeader('Cache-Control', 'no-store');

  // Mirrors next-auth: `detectOrigin()` returns NEXTAUTH_URL verbatim when it
  // is set, and `[...nextauth].ts` sets it from `getConfiguredAppUrl()`. The
  // request origin is reported alongside so drift between the two is visible.
  const configuredAppUrl = getConfiguredAppUrl();
  const nextAuthUrl = getEnv('NEXTAUTH_URL');
  const requestOrigin = getRequestOrigin(req);
  const signInOrigin = configuredAppUrl ?? requestOrigin ?? getAppBaseUrl(req);

  const signInRedirectUri = `${signInOrigin.replace(/\/+$/, '')}/api/auth/callback/google`;

  const appConnections = CONNECT_APPS.map((app) => ({
    id: app.id,
    name: app.name,
    registerIn: app.provider,
    redirectUri: getIntegrationRedirectUri(app.id, req),
  }));

  const legacySlackCallback = `${getAppBaseUrl(req)}/api/auth/slack/callback`;

  // Deduplicated list ready to paste into the provider console.
  const requiredRegistrations = Array.from(
    new Set([signInRedirectUri, legacySlackCallback, ...appConnections.map((app) => app.redirectUri)]),
  );

  return res.status(200).json({
    success: true,
    data: {
      signIn: {
        provider: 'google',
        redirectUri: signInRedirectUri,
        clientId: maskClientId(getEnv('GOOGLE_CLIENT_ID')),
        clientSecretConfigured: Boolean(getEnv('GOOGLE_CLIENT_SECRET')),
        scopes: getEnv('GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY') === 'true' ? 'profile only' : 'Google Workspace suite',
        registerIn: 'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs',
      },
      appConnections,
      requiredRegistrations,
      config: {
        APP_URL: configuredAppUrl ?? null,
        NEXTAUTH_URL: nextAuthUrl ?? null,
        requestOrigin: requestOrigin ?? null,
        // When these disagree, the deployment is pinning callbacks to one host
        // while users browse another — register the pinned URI, or align the
        // variables. Sign-in always follows APP_URL/NEXTAUTH_URL.
        originDrift: Boolean(requestOrigin && configuredAppUrl && requestOrigin !== configuredAppUrl),
      },
      notes: [
        'Exact match only: scheme, host, port, path and no trailing slash.',
        'http://localhost:3000/api/auth/callback/google is only needed for local development.',
        'After editing the OAuth client, changes can take a few minutes to propagate; also confirm the client ID above matches the client you edited.',
        'If the client type is "Desktop app", Google refuses web redirect URIs — the client must be "Web application".',
      ],
    },
  });
}
