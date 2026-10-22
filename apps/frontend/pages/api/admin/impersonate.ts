import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../lib/admin-auth';
import { AUDIT_ACTIONS, logAdminEvent } from '../../../lib/admin-events';
import { createImpersonationToken, IMPERSONATION_TTL_SECONDS } from '../../../lib/impersonation';
import { getAppBaseUrl } from '../../../lib/app-url';
import prisma from '../../../lib/prisma';

/**
 * Issues a single-use impersonation link (SUPER_ADMIN only).
 *
 * Nothing here reads or exposes the target's password. The link mints a normal
 * NextAuth session for the target user that expires in one hour; see
 * `lib/impersonation.ts` for the signing and single-use rules.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const admin = await requireAdmin(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
  if (!userId) {
    return res.status(400).json({ success: false, error: { code: 'USER_ID_REQUIRED', message: 'A user id is required.' } });
  }
  if (userId === admin.id) {
    return res.status(409).json({
      success: false,
      error: { code: 'SELF_IMPERSONATION', message: 'You are already signed in as this account.' },
    });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, adminRole: true },
    });
    if (!target) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }

    const { token, claims } = createImpersonationToken({ adminId: admin.id, targetUserId: target.id });
    const expiresAt = new Date(claims.exp * 1000);

    // The audit row doubles as the single-use registry: consuming the link
    // stamps `consumedAt` onto this row and refuses a second use.
    await logAdminEvent({
      actor: adminActor(admin),
      action: AUDIT_ACTIONS.userImpersonated,
      targetType: 'user',
      targetId: target.id,
      metadata: {
        jti: claims.jti,
        expiresAt: expiresAt.toISOString(),
        consumedAt: null,
        targetEmail: target.email,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      data: {
        url: `${getAppBaseUrl(req)}/api/admin/impersonate/consume?token=${encodeURIComponent(token)}`,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: IMPERSONATION_TTL_SECONDS,
        user: { id: target.id, email: target.email, name: target.name, plan: target.plan, adminRole: target.adminRole },
      },
      message: 'Single-use impersonation link created. It expires in 1 hour.',
    });
  } catch (error) {
    console.error('Impersonation issue error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'IMPERSONATION_UNAVAILABLE', message: 'An impersonation link could not be created.' },
    });
  }
}
