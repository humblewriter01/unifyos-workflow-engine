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
  });
  if (!user || !hasAdminRole(user.adminRole, allowed)) {
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
