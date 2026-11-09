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
 *   GET /api/diagnostics/oauth          → the exact strings this build sends
 *   GET /api/diagnostics/oauth?probe=1  → ...and whether Google accepts them
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

const AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

export type ProbeVerdict =
  | 'registered'
  | 'not_registered'
  | 'client_invalid'
  | 'scope_invalid'
  | 'other_error'
  | 'unreachable';

export interface ProbeResult {
  /** Which flow this URI belongs to, filled in by the handler. */
  label?: string;
  redirectUri: string;
  verdict: ProbeVerdict;
  httpStatus: number | null;
  message: string;
}

/** Strips tags/scripts and collapses whitespace so Google's HTML page is readable. */
function readableExcerpt(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const marker = text.search(/Error \d{3}|redirect_uri_mismatch|invalid_client|invalid_scope/i);
  const slice = marker > 0 ? text.slice(marker, marker + 400) : text.slice(0, 400);
  return slice.trim();
}

/**
 * Asks Google itself whether a `redirect_uri` is registered on the configured
 * OAuth client.
 *
 * Google rejects a bad `redirect_uri` **before** redirecting anywhere, so the
 * app never sees the failure — but the authorize endpoint still answers, and
 * its answer says exactly which of the three setup mistakes happened:
 * unknown URI, unknown client, or unapproved scope. This is the difference
 * between "the console edit has not propagated yet" and "you edited a
 * different OAuth client".
 *
 * No user data and no credentials are sent: the request carries only the
 * (public) client ID and a placeholder `state`.
 */
async function probeRedirectUri(redirectUri: string, clientId: string): Promise<ProbeResult> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'offline',
    include_granted_scopes: 'true',
    state: 'unifyos-diagnostic-probe',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // `manual` so an accepted URI is visible as its own 302 — following it
    // would land on the Google sign-in page and hide the distinction.
    const response = await fetch(`${AUTHORIZE_ENDPOINT}?${params.toString()}`, {
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: 'text/html', 'user-agent': 'unifyos-oauth-diagnostics/1.0' },
    });

    // A rejected redirect_uri is always an HTML 400. A 3xx means Google
    // accepted it and moved on to the sign-in/consent step.
    if (response.status >= 300 && response.status < 400) {
      return {
        redirectUri,
        verdict: 'registered',
        httpStatus: response.status,
        message: `Google accepted this redirect_uri (HTTP ${response.status} to ${response.headers.get('location') ?? 'the next step'}).`,
      };
    }
    if (response.status < 300) {
      return {
        redirectUri,
        verdict: 'registered',
        httpStatus: response.status,
        message: 'Google accepted this redirect_uri (it answered with a consent page instead of an error).',
      };
    }
    if (response.status === 0) {
      return {
        redirectUri,
        verdict: 'other_error',
        httpStatus: 0,
        message: 'Google answered with an opaque redirect; the probe could not read a status.',
      };
    }

    const body = (await response.text()).slice(0, 200_000);
    const excerpt = readableExcerpt(body);

    if (/redirect_uri_mismatch/i.test(body)) {
      return {
        redirectUri,
        verdict: 'not_registered',
        httpStatus: response.status,
        message:
          'Google does not have this exact redirect_uri on the OAuth client that GOOGLE_CLIENT_ID points at.',
      };
    }
    if (/invalid_client|OAuth client was not found|deleted_client/i.test(body)) {
      return {
        redirectUri,
        verdict: 'client_invalid',
        httpStatus: response.status,
        message:
          'Google does not recognise GOOGLE_CLIENT_ID — the client was deleted, belongs to another project, or is not a "Web application" client.',
      };
    }
    if (/invalid_scope/i.test(body)) {
      return {
        redirectUri,
        verdict: 'scope_invalid',
        httpStatus: response.status,
        message: 'The redirect_uri is fine, but a requested scope is not on the OAuth consent screen.',
      };
    }
    return {
      redirectUri,
      verdict: 'other_error',
      httpStatus: response.status,
      message: excerpt || 'Google returned an error without a recognisable marker.',
    };
  } catch (error) {
    return {
      redirectUri,
      verdict: 'unreachable',
      httpStatus: null,
      message:
        error instanceof Error && error.name === 'AbortError'
          ? 'The probe to accounts.google.com timed out after 8s.'
          : `Could not reach accounts.google.com: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Warm lambdas keep the last answer for a minute so repeats do not hit Google. */
let probeCache: { at: number; payload: unknown } | null = null;
const PROBE_TTL_MS = 60_000;

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

  const googleAppsCallback =
    appConnections.find((app) => app.id === 'google')?.redirectUri ?? `${signInOrigin}/api/apps/google/callback`;

  const clientId = getEnv('GOOGLE_CLIENT_ID');

  // `?probe=1` additionally asks Google whether each Google redirect URI is
  // registered. That is the only way to tell "the console edit has not
  // propagated" from "the edit landed on a different OAuth client".
  let probe: ProbeResult[] | undefined;
  if (req.query.probe !== undefined && req.query.probe !== '0' && req.query.probe !== 'false') {
    if (!clientId) {
      probe = [
        {
          redirectUri: signInRedirectUri,
          verdict: 'client_invalid',
          httpStatus: null,
          message: 'GOOGLE_CLIENT_ID is not set in this environment.',
        },
      ];
    } else if (probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) {
      probe = probeCache.payload as ProbeResult[];
    } else {
      const targets = [
        { label: 'sign-in (production host)', uri: signInRedirectUri },
        { label: 'Workspace Connect (production host)', uri: googleAppsCallback },
        { label: 'sign-in (localhost, dev only)', uri: 'http://localhost:3000/api/auth/callback/google' },
      ];
      const settled = await Promise.all(targets.map((target) => probeRedirectUri(target.uri, clientId)));
      probe = settled.map((result, index) => ({ ...result, label: targets[index].label }));
      probeCache = { at: Date.now(), payload: probe };
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      signIn: {
        provider: 'google',
        redirectUri: signInRedirectUri,
        appRedirectUri: googleAppsCallback,
        clientId: maskClientId(clientId ?? undefined),
        clientSecretConfigured: Boolean(getEnv('GOOGLE_CLIENT_SECRET')),
        scopes: getEnv('GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY') === 'true' ? 'profile only' : 'Google Workspace suite',
        registerIn: 'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs',
      },
      appConnections,
      requiredRegistrations,
      ...(probe ? { probe } : {}),
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
