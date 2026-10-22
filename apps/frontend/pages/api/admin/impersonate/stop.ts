import type { NextApiRequest, NextApiResponse } from 'next';
import { decode } from 'next-auth/jwt';
import { getEnv } from '../../../../lib/env';
import { getAppBaseUrl } from '../../../../lib/app-url';
import { ADMIN_SESSION_BACKUP_COOKIE, sessionCookieName } from '../../../../lib/impersonation';
import { logAdminEvent } from '../../../../lib/admin-events';

/**
 * Ends an impersonation session by restoring the operator's own session cookie.
 * Without the backup cookie (for example after it expired) the operator is sent
 * to the login page instead of being left signed in as the customer.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const secret = getEnv('NEXTAUTH_SECRET');
  const secure =
    (getEnv('NEXTAUTH_URL') ?? '').startsWith('https://') ||
    String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
  const cookieName = sessionCookieName(secure);
  const backup = req.cookies[ADMIN_SESSION_BACKUP_COOKIE];

  if (!backup || !secret) {
    res.setHeader('Set-Cookie', [`${ADMIN_SESSION_BACKUP_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`]);
    return res.redirect(302, `${getAppBaseUrl(req)}/auth/login`);
  }

  const admin = await decode({ token: backup, secret }).catch(() => null);
  const impersonated = req.cookies[cookieName]
    ? await decode({ token: req.cookies[cookieName], secret }).catch(() => null)
    : null;

  await logAdminEvent({
    actor: admin ? { id: String(admin.id ?? admin.sub ?? ''), email: String(admin.email ?? '') } : { id: '', email: 'unknown' },
    action: 'admin.user.impersonation_ended',
    targetType: 'user',
    targetId: String(impersonated?.id ?? impersonated?.sub ?? ''),
    metadata: { targetEmail: impersonated?.email ?? null },
    req,
  });

  res.setHeader('Set-Cookie', [
    `${cookieName}=${backup}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
    `${ADMIN_SESSION_BACKUP_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`,
  ]);
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, `${getAppBaseUrl(req)}/admin`);
}
