import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import { getGoogleClients, type GoogleClients } from './google';
import { GoogleAuthError, GOOGLE_CONNECT_PATH } from './google-auth';

/**
 * Shared plumbing for the `/api/integrations/google/*` routes: method guard,
 * session lookup, client construction and a single place that translates
 * Google's error shapes into actionable API responses.
 */

interface GoogleRouteContext {
  req: NextApiRequest;
  res: NextApiResponse;
  userId: string;
  clients: GoogleClients;
}

type GoogleRouteHandler = (context: GoogleRouteContext) => Promise<void> | void;

function readGoogleError(error: unknown): { status?: number; message: string; reason?: string } {
  const candidate = error as {
    message?: string;
    response?: {
      status?: number;
      data?: { error?: { message?: string; status?: string; errors?: Array<{ message?: string; reason?: string }> } };
    };
  };

  const apiError = candidate?.response?.data?.error;

  return {
    status: candidate?.response?.status,
    message: apiError?.message || candidate?.message || 'Unknown Google API error',
    reason: apiError?.errors?.[0]?.reason,
  };
}

export function sendGoogleError(res: NextApiResponse, error: unknown): void {
  if (error instanceof GoogleAuthError) {
    const status = error.code === 'GOOGLE_NOT_CONFIGURED' ? 503 : 409;
    res.status(status).json({
      success: false,
      error: error.message,
      code: error.code,
      connectUrl: GOOGLE_CONNECT_PATH,
    });
    return;
  }

  const { status, message, reason } = readGoogleError(error);

  if (status === 401) {
    res.status(409).json({
      success: false,
      error: 'Google rejected the stored credentials. Reconnect Google to continue.',
      code: 'GOOGLE_RECONNECT_REQUIRED',
      connectUrl: GOOGLE_CONNECT_PATH,
    });
    return;
  }

  if (status === 403) {
    // Ticking off a scope during consent is the usual cause here.
    const isScopeIssue = /insufficient|scope|permission/i.test(message) || reason === 'insufficientPermissions';

    res.status(403).json({
      success: false,
      error: isScopeIssue
        ? `Google denied this request because a required permission was not granted: ${message}`
        : `Google denied this request: ${message}`,
      code: isScopeIssue ? 'GOOGLE_SCOPE_MISSING' : 'GOOGLE_PERMISSION_DENIED',
      reason: reason ?? null,
      connectUrl: GOOGLE_CONNECT_PATH,
    });
    return;
  }

  if (status === 400) {
    // Invalid range, malformed ID, bad time zone — the caller can fix this.
    res.status(400).json({ success: false, error: `Google rejected the request: ${message}`, code: 'GOOGLE_INVALID_REQUEST' });
    return;
  }

  if (status === 404) {
    res.status(404).json({ success: false, error: `Not found: ${message}`, code: 'GOOGLE_RESOURCE_NOT_FOUND' });
    return;
  }

  if (status === 429) {
    res.status(429).json({
      success: false,
      error: 'Google rate-limited this request. Try again shortly.',
      code: 'GOOGLE_RATE_LIMITED',
    });
    return;
  }

  console.error('[google-route] Unhandled Google API error:', error);
  res.status(502).json({
    success: false,
    error: `Google API request failed: ${message}`,
    code: 'GOOGLE_API_ERROR',
    status: status ?? null,
  });
}

/**
 * Wraps a Google route handler with auth, client setup and error handling.
 *
 * The Google clients are built once per request, so a single token refresh
 * covers every API used by the handler.
 */
export function withGoogle(method: 'GET' | 'POST', handler: GoogleRouteHandler) {
  return async function googleRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== method) {
      res.setHeader('Allow', [method]);
      return res.status(405).json({ success: false, error: `Method ${req.method} not allowed`, code: 'METHOD_NOT_ALLOWED' });
    }

    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Sign in required.', code: 'AUTH_REQUIRED' });
    }

    try {
      const clients = await getGoogleClients(userId);
      await handler({ req, res, userId, clients });
    } catch (error) {
      sendGoogleError(res, error);
    }
  };
}

/** Reads a string body field, trimmed, with a hard length cap. */
export function readStringField(body: unknown, key: string, maxLength = 500): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function readNumberField(body: unknown, key: string): number | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as Record<string, unknown>)[key];
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readQueryString(req: NextApiRequest, key: string, maxLength = 500): string | undefined {
  const value = req.query[key];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, maxLength) : undefined;
}
