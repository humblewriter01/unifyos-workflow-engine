import { OAuth2Client } from 'googleapis-common';
import prisma from './prisma';
import { getEnv } from './env';
import { decryptToken, encryptToken } from './oauth';
import { GOOGLE_FULL_SCOPES, GOOGLE_INTEGRATION_SCOPES } from './google-scopes';

/**
 * Google OAuth2 token lifecycle for UnifyOS.
 *
 * Tokens live in the existing `AppToken` table under `appName = 'google'`
 * (one row per user, encrypted at rest with `ENCRYPTION_KEY`). No schema change
 * is involved: `accessToken`, `refreshToken`, `expiresAt`, `scope` and
 * `metadata` already cover everything needed.
 */

/** `AppToken.appName` for the unified Google Workspace connection. */
export const GOOGLE_APP_TOKEN_NAME = 'google';

/** Refresh a little early so a token cannot expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

export type GoogleAuthErrorCode =
  | 'GOOGLE_NOT_CONFIGURED'
  | 'GOOGLE_NOT_CONNECTED'
  | 'GOOGLE_RECONNECT_REQUIRED';

export class GoogleAuthError extends Error {
  readonly code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

/** Where the UI sends users to re-authorise. */
export const GOOGLE_CONNECT_PATH = '/settings/integrations';

function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new GoogleAuthError(
      'GOOGLE_NOT_CONFIGURED',
      'Google is not configured on this deployment. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    );
  }

  return { clientId, clientSecret };
}

/** A fresh OAuth2 client, optionally bound to a redirect URI. */
export function createGoogleOAuthClient(redirectUri?: string): OAuth2Client {
  const { clientId, clientSecret } = getGoogleCredentials();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Consent URL used by the integration "Connect" button.
 *
 * `access_type=offline` + `prompt=consent` guarantee a refresh token, and
 * `include_granted_scopes` lets previously granted permissions carry over.
 */
export function buildGoogleConsentUrl(params: {
  state: string;
  redirectUri: string;
  scopes?: readonly string[];
}): string {
  const client = createGoogleOAuthClient(params.redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [...(params.scopes ?? GOOGLE_FULL_SCOPES)],
    state: params.state,
  });
}

export interface GoogleConnectionStatus {
  connected: boolean;
  /** Scopes Google actually granted, when known. */
  grantedScopes: string[];
  /** Integration scopes that are missing from the granted set. */
  missingScopes: string[];
  expiresAt: Date | null;
  /** True when the row exists but cannot be refreshed without a new consent. */
  needsReconnect: boolean;
}

export async function getGoogleConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
  const record = await prisma.appToken.findUnique({
    where: { userId_appName: { userId, appName: GOOGLE_APP_TOKEN_NAME } },
    select: { connected: true, scope: true, refreshToken: true, expiresAt: true },
  });

  if (!record?.connected) {
    return { connected: false, grantedScopes: [], missingScopes: [...GOOGLE_INTEGRATION_SCOPES], expiresAt: null, needsReconnect: false };
  }

  const grantedScopes = record.scope ? record.scope.split(/\s+/).filter(Boolean) : [];
  const missingScopes = GOOGLE_INTEGRATION_SCOPES.filter((scope) => !grantedScopes.includes(scope));

  return {
    connected: true,
    grantedScopes,
    missingScopes,
    expiresAt: record.expiresAt ?? null,
    needsReconnect: !record.refreshToken,
  };
}

async function markDisconnected(userId: string): Promise<void> {
  try {
    await prisma.appToken.updateMany({
      where: { userId, appName: GOOGLE_APP_TOKEN_NAME },
      data: { connected: false },
    });
  } catch (error) {
    console.error('[google-auth] Failed to mark Google token as disconnected:', error);
  }
}

/**
 * Returns a ready-to-use OAuth2 client for a user, refreshing the access token
 * when it has expired (or is about to) and persisting the result.
 *
 * Throws `GoogleAuthError` when the user has never connected, when the refresh
 * token was revoked, or when the deployment is missing its client credentials.
 */
export async function getGoogleAuthClient(userId: string): Promise<OAuth2Client> {
  const { clientId, clientSecret } = getGoogleCredentials();

  const record = await prisma.appToken.findUnique({
    where: { userId_appName: { userId, appName: GOOGLE_APP_TOKEN_NAME } },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      scope: true,
      connected: true,
    },
  });

  if (!record || !record.connected) {
    throw new GoogleAuthError(
      'GOOGLE_NOT_CONNECTED',
      'Google Workspace is not connected for this account yet.',
    );
  }

  const accessToken = decryptToken(record.accessToken);
  const refreshToken = record.refreshToken ? decryptToken(record.refreshToken) : null;

  if (!accessToken) {
    await markDisconnected(userId);
    throw new GoogleAuthError(
      'GOOGLE_RECONNECT_REQUIRED',
      'The stored Google credentials could not be read. Reconnect Google to continue.',
    );
  }

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    expiry_date: record.expiresAt ? record.expiresAt.getTime() : undefined,
  });

  const expiresAt = record.expiresAt ? record.expiresAt.getTime() : null;
  const isExpired = expiresAt !== null && expiresAt <= Date.now() + EXPIRY_SKEW_MS;

  // A null expiry means Google did not tell us; trusting the token is the only
  // option, and a 401 from the API will surface as a normal error.
  if (!isExpired) {
    void prisma.appToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch((error: unknown) => console.error('[google-auth] Failed to record token use:', error));
    return client;
  }

  if (!refreshToken) {
    await markDisconnected(userId);
    throw new GoogleAuthError(
      'GOOGLE_RECONNECT_REQUIRED',
      'The Google access token expired and no refresh token is stored. Reconnect Google with offline access.',
    );
  }

  try {
    const { credentials } = await client.refreshAccessToken();
    const nextAccessToken = credentials.access_token;

    if (!nextAccessToken) {
      throw new Error('Google returned no access token during refresh.');
    }

    client.setCredentials(credentials);

    // Google normally keeps the same refresh token; only overwrite when a new
    // one is actually issued, otherwise we would erase a valid credential.
    const nextRefreshToken = credentials.refresh_token;

    await prisma.appToken.update({
      where: { id: record.id },
      data: {
        accessToken: encryptToken(nextAccessToken),
        ...(nextRefreshToken ? { refreshToken: encryptToken(nextRefreshToken) } : {}),
        expiresAt: new Date(credentials.expiry_date ?? Date.now() + 3_600_000),
        ...(credentials.scope ? { scope: credentials.scope } : {}),
        connected: true,
        lastUsedAt: new Date(),
      },
    });

    return client;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[google-auth] Google token refresh failed:', message);

    // `invalid_grant` means the user revoked access (or the token expired past
    // Google's limit). Retrying will never succeed, so flag a reconnect.
    if (/invalid_grant|invalid_request|unauthorized_client/i.test(message)) {
      await markDisconnected(userId);
      throw new GoogleAuthError(
        'GOOGLE_RECONNECT_REQUIRED',
        'Google access was revoked or expired. Reconnect Google to continue.',
      );
    }

    throw new GoogleAuthError(
      'GOOGLE_RECONNECT_REQUIRED',
      'Google rejected the stored credentials. Reconnect Google to continue.',
    );
  }
}

/** Deletes the stored Google tokens for a user (used by the disconnect action). */
export async function disconnectGoogle(userId: string): Promise<void> {
  await prisma.appToken.deleteMany({
    where: { userId, appName: GOOGLE_APP_TOKEN_NAME },
  });
}
