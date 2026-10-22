import type { NextApiRequest } from 'next';
import { getEnv } from './env';

/**
 * Single source of truth for the application's absolute public URL.
 *
 * OAuth providers compare the `redirect_uri` sent on the authorize request with
 * the one sent on the token exchange, and both must byte-for-byte match a URI
 * registered in the provider console. Deriving that value in one place is what
 * keeps localhost development and Vercel deployments working at the same time.
 */

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Normalises `host`, `host/path`, or a full URL into a canonical origin. */
export function normalizeAppUrl(value?: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim().replace(/^['"]+/, '').replace(/['"]+$/, '').trim();
  if (!trimmed) return undefined;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (!url.hostname) return undefined;
    const path = stripTrailingSlash(url.pathname);
    return stripTrailingSlash(`${url.protocol}//${url.host}${path === '/' ? '' : path}`);
  } catch {
    return undefined;
  }
}

export function isLocalhostUrl(value?: string | null): boolean {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/** True when the process is running on a hosted platform with a public URL. */
export function isHostedPlatform(): boolean {
  return Boolean(getEnv('VERCEL') || getEnv('RENDER') || getEnv('RENDER_EXTERNAL_URL'));
}

/** The public URL the platform itself exposes, when running hosted. */
export function getPlatformAppUrl(): string | undefined {
  if (getEnv('VERCEL')) {
    const production = normalizeAppUrl(getEnv('VERCEL_PROJECT_PRODUCTION_URL'));
    const deployment = normalizeAppUrl(getEnv('VERCEL_URL'));
    // Preview deployments get an ephemeral hostname, so use the deployment URL
    // there and the stable production domain everywhere else.
    return getEnv('VERCEL_ENV') === 'preview'
      ? deployment ?? production
      : production ?? deployment;
  }

  return normalizeAppUrl(getEnv('RENDER_EXTERNAL_URL'));
}

/**
 * The URL the operator explicitly configured, in priority order.
 * `APP_URL` is the canonical name; `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`
 * stay supported for existing deployments.
 *
 * A localhost value is ignored on a hosted platform. `NEXTAUTH_URL` copied
 * verbatim from `.env.example` into a hosting dashboard is the single most
 * common cause of Google's `redirect_uri_mismatch`, because next-auth 4.24.x
 * prefers it over the platform's own detected origin.
 */
export function getConfiguredAppUrl(): string | undefined {
  const explicit = [
    normalizeAppUrl(getEnv('APP_URL')),
    normalizeAppUrl(getEnv('NEXT_PUBLIC_APP_URL')),
    normalizeAppUrl(getEnv('NEXTAUTH_URL')),
  ].filter((value): value is string => Boolean(value));

  const hosted = isHostedPlatform();
  const usable = hosted ? explicit.filter((value) => !isLocalhostUrl(value)) : explicit;

  if (usable.length > 0) return usable[0];

  return getPlatformAppUrl();
}

function firstHeaderValue(value?: string | string[]): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() || undefined;
}

/** The origin the current request actually arrived on (Vercel/Render aware). */
export function getRequestOrigin(req?: NextApiRequest): string | undefined {
  if (!req?.headers) return undefined;

  const host =
    firstHeaderValue(req.headers['x-forwarded-host'] as string | string[]) ??
    firstHeaderValue(req.headers.host as string | string[]);

  if (!host) return undefined;

  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto'] as string | string[]);
  const proto = forwardedProto ?? (isLocalhostUrl(`http://${host}`) ? 'http' : 'https');

  return normalizeAppUrl(`${proto}://${host}`);
}

/**
 * Absolute base URL for redirects and OAuth callbacks.
 *
 * Pass the current request so a stale `NEXTAUTH_URL=http://localhost:3000`
 * copied from `.env.example` into a hosting dashboard can never leak a
 * localhost redirect into production.
 */
export function getAppBaseUrl(req?: NextApiRequest): string {
  const configured = getConfiguredAppUrl();
  const requestOrigin = getRequestOrigin(req);

  if (configured && requestOrigin) {
    // A localhost value is only honoured when we are actually on localhost.
    if (isLocalhostUrl(configured) && !isLocalhostUrl(requestOrigin)) return requestOrigin;
    return configured;
  }

  if (configured) return configured;
  if (requestOrigin) return requestOrigin;

  return `http://localhost:${getEnv('PORT') || '3000'}`;
}

/** Builds an absolute redirect URI for a callback path. */
export function getOAuthCallbackUrl(path: string, req?: NextApiRequest): string {
  const base = getAppBaseUrl(req);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
