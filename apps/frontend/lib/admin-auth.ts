import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import prisma from './prisma';

type AdminRole = 'SUPPORT_READONLY' | 'BILLING_ADMIN' | 'CATALOG_ADMIN' | 'SUPER_ADMIN';

const roleRank: Record<AdminRole, number> = {
  SUPPORT_READONLY: 10,
  BILLING_ADMIN: 20,
  CATALOG_ADMIN: 20,
  SUPER_ADMIN: 100,
};

export function hasAdminRole(role: string | null | undefined, allowed: AdminRole[]): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  return allowed.includes(role as AdminRole);
}

/**
 * True for every role that may reach `/admin`.
 *
 * `ADMIN` is not a member of the `AdminRole` enum (adding one would need a
 * migration, which is out of scope), so `SUPER_ADMIN` is the platform's
 * "full admin" role and the page is open to all four privileged roles with
 * capability checks on the individual actions.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return Boolean(role) && role !== 'NONE';
}

/** Normalises a `requireAdmin()` result into the actor shape audit rows need. */
export function adminActor(user: { id: string; email: string }): { id: string; email: string } {
  return { id: user.id, email: user.email };
}

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  allowed: AdminRole[] = ['SUPPORT_READONLY', 'BILLING_ADMIN', 'CATALOG_ADMIN', 'SUPER_ADMIN'],
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, adminRole: true, twoFactorEnabled: true },
  }).catch((error) => {
    // A database outage must not surface as an unhandled 500 on every admin
    // route; fail closed with an actionable status instead.
    console.error('requireAdmin database lookup failed:', error instanceof Error ? error.message : error);
    return null;
  });
  if (!user) {
    // Distinguish "no such user / db unavailable" from "authenticated but not
    // an admin": we cannot authorise what we cannot read.
    res.status(503).json({ success: false, error: { code: 'ADMIN_UNAVAILABLE', message: 'Administrator verification is temporarily unavailable.' } });
    return null;
  }
  if (!hasAdminRole(user.adminRole, allowed)) {
    res.status(403).json({ success: false, error: { code: 'ADMIN_FORBIDDEN', message: 'Administrator access is required.' } });
    return null;
  }
  if (!user.twoFactorEnabled) {
    res.status(403).json({ success: false, error: { code: 'ADMIN_MFA_REQUIRED', message: 'Administrator MFA must be enabled.' } });
    return null;
  }

  return user;
}

export async function writeAdminAudit(
  userId: string,
  action: string,
  resource: string,
  metadata: Record<string, unknown> = {},
) {
  await prisma.auditLog.create({
    data: { userId, action, resource, metadata: metadata as any },
  });
}

export function roleRankFor(role: string): number {
  return roleRank[role as AdminRole] ?? 0;
}
