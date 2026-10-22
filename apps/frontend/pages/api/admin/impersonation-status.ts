import type { NextApiRequest, NextApiResponse } from 'next';
import { decode } from 'next-auth/jwt';
import { getEnv } from '../../../lib/env';
import { ADMIN_SESSION_BACKUP_COOKIE, sessionCookieName } from '../../../lib/impersonation';

/**
 * Tells the dashboard whether the current session is an impersonation, so it can
 * show a persistent "you are viewing as X" bar. The impersonated session alone
 * cannot know this (it *is* the customer), so the presence of the backup cookie
 * is the signal.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const secret = getEnv('NEXTAUTH_SECRET');
  const secure =
    (getEnv('NEXTAUTH_URL') ?? '').startsWith('https://') ||
    String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
  const backup = req.cookies[ADMIN_SESSION_BACKUP_COOKIE];

  res.setHeader('Cache-Control', 'no-store');
  if (!backup || !secret) return res.status(200).json({ success: true, data: { impersonating: false } });

  const [admin, current] = await Promise.all([
    decode({ token: backup, secret }).catch(() => null),
    req.cookies[sessionCookieName(secure)]
      ? decode({ token: req.cookies[sessionCookieName(secure)], secret }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      impersonating: true,
      adminEmail: admin?.email ? String(admin.email) : null,
      userEmail: current?.email ? String(current.email) : null,
    },
  });
}
