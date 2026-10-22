import type { NextApiRequest, NextApiResponse } from 'next';
import { encode } from 'next-auth/jwt';
import prisma from '../../../../lib/prisma';
import { getEnv } from '../../../../lib/env';
import { getAppBaseUrl } from '../../../../lib/app-url';
import {
  ADMIN_SESSION_BACKUP_COOKIE,
  IMPERSONATION_TTL_SECONDS,
  isVerifiedImpersonation,
  sessionCookieName,
  verifyImpersonationToken,
} from '../../../../lib/impersonation';
import { AUDIT_ACTIONS, logAdminEvent, readMetadata } from '../../../../lib/admin-events';

/**
 * Consumes an impersonation link.
 *
 * Flow:
 *  1. Verify the HMAC signature and 1-hour expiry.
 *  2. Find the issuing audit row and refuse if it was already consumed.
 *  3. Mint a real NextAuth JWT for the target user (1 hour) and set it as the
 *     session cookie.
 *  4. Stash the admin's own session in a separate httpOnly cookie so
 *     `/api/admin/impersonate/stop` can restore it without a new login.
 *  5. Stamp the audit row as consumed and redirect into the dashboard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    return res.status(400).json({ success: false, error: { code: 'TOKEN_REQUIRED', message: 'An impersonation token is required.' } });
  }

  const verified = verifyImpersonationToken(token);
  if (!isVerifiedImpersonation(verified)) {
    const expired = verified.reason === 'EXPIRED';
    return res.status(expired ? 410 : 400).json({
      success: false,
      error: {
        code: expired ? 'IMPERSONATION_LINK_EXPIRED' : 'IMPERSONATION_LINK_INVALID',
        message: expired ? 'This impersonation link has expired. Generate a new one.' : 'This impersonation link is not valid.',
      },
    });
  }

  const { claims } = verified;
  const secret = getEnv('NEXTAUTH_SECRET');
  if (!secret) {
    return res.status(503).json({
      success: false,
      error: { code: 'IMPERSONATION_NOT_CONFIGURED', message: 'Impersonation is not configured for this environment.' },
    });
  }

  try {
    // Locate the issuing row. JSON path filtering keeps this to one indexed
    // query in Postgres; the fallback scans the target's recent rows in case the
    // runtime cannot express the filter.
    const baseWhere = {
      action: AUDIT_ACTIONS.userImpersonated,
      targetType: 'user',
      targetId: claims.tgt,
    };
    let issuingRow = await prisma.adminAuditLog
      .findFirst({
        where: { ...baseWhere, metadata: { path: ['jti'], equals: claims.jti } } as any,
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);
    if (!issuingRow) {
      const recent = await prisma.adminAuditLog.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      issuingRow = recent.find((row) => readMetadata(row.metadata).jti === claims.jti) ?? null;
    }

    if (!issuingRow) {
      return res.status(400).json({
        success: false,
        error: { code: 'IMPERSONATION_LINK_INVALID', message: 'This impersonation link is not valid.' },
      });
    }
    if (readMetadata(issuingRow.metadata).consumedAt) {
      return res.status(403).json({
        success: false,
        error: { code: 'IMPERSONATION_LINK_USED', message: 'This impersonation link has already been used. Generate a new one.' },
      });
    }

    const target = await prisma.user.findUnique({
      where: { id: claims.tgt },
      select: { id: true, email: true, name: true, plan: true, adminRole: true },
    });
    if (!target) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionToken = await encode({
      secret,
      maxAge: IMPERSONATION_TTL_SECONDS,
      token: {
        sub: target.id,
        id: target.id,
        email: target.email,
        name: target.name ?? target.email,
        plan: target.plan,
        adminRole: target.adminRole,
        iat: now,
        exp: now + IMPERSONATION_TTL_SECONDS,
        jti: claims.jti,
      },
    });

    const secure =
      (getEnv('NEXTAUTH_URL') ?? '').startsWith('https://') ||
      String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
    const cookieName = sessionCookieName(secure);
    const currentSession = req.cookies[cookieName];

    const cookies: string[] = [];
    if (currentSession && currentSession !== sessionToken) {
      // Preserve the operator's own session so "stop impersonating" is instant.
      cookies.push(
        `${ADMIN_SESSION_BACKUP_COOKIE}=${currentSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${IMPERSONATION_TTL_SECONDS}${secure ? '; Secure' : ''}`,
      );
    }
    cookies.push(
      `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${IMPERSONATION_TTL_SECONDS}${secure ? '; Secure' : ''}`,
    );

    await prisma.adminAuditLog.update({
      where: { id: issuingRow.id },
      data: {
        metadata: {
          ...readMetadata(issuingRow.metadata),
          consumedAt: new Date().toISOString(),
          consumedIp: String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || null,
        } as any,
      },
    });
    await logAdminEvent({
      actor: { id: issuingRow.adminId ?? '', email: issuingRow.adminEmail },
      action: 'admin.user.impersonation_started',
      targetType: 'user',
      targetId: target.id,
      metadata: { jti: claims.jti, targetEmail: target.email },
      req,
    });

    res.setHeader('Set-Cookie', cookies);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, `${getAppBaseUrl(req)}/?impersonating=1`);
  } catch (error) {
    console.error('Impersonation consume error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'IMPERSONATION_UNAVAILABLE', message: 'Impersonation is temporarily unavailable.' },
    });
  }
}
