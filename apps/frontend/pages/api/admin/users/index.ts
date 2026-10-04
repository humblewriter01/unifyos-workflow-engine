import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, writeAdminAudit } from '../../../../lib/admin-auth';
import prisma from '../../../../lib/prisma';

const roles = ['NONE', 'SUPPORT_READONLY', 'BILLING_ADMIN', 'CATALOG_ADMIN', 'SUPER_ADMIN'] as const;
const plans = ['FREE', 'PRO', 'BUSINESS'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res, ['SUPER_ADMIN']);
  if (!admin) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, email: true, name: true, plan: true, adminRole: true, emailVerified: true, twoFactorEnabled: true, createdAt: true, lastLoginAt: true },
    });
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(503).json({ success: false, error: { code: 'ADMIN_USERS_UNAVAILABLE', message: 'User administration is temporarily unavailable.' } });
  }
}

export { roles, plans };
