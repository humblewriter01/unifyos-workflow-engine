import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, writeAdminAudit } from '../../../../lib/admin-auth';
import prisma from '../../../../lib/prisma';

const roles = ['NONE', 'SUPPORT_READONLY', 'BILLING_ADMIN', 'CATALOG_ADMIN', 'SUPER_ADMIN'] as const;
const plans = ['FREE', 'PRO', 'BUSINESS'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res, ['SUPER_ADMIN']);
  if (!admin) return;
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const nextRole = typeof req.body?.adminRole === 'string' ? req.body.adminRole : undefined;
  const nextPlan = typeof req.body?.plan === 'string' ? req.body.plan : undefined;
  const emailVerified = typeof req.body?.emailVerified === 'boolean' ? req.body.emailVerified : undefined;
  if (!id || (!nextRole && !nextPlan && emailVerified === undefined)) return res.status(400).json({ success: false, error: { code: 'NO_CHANGES', message: 'Provide an admin role, plan, or email verification change.' } });
  if (nextRole && !roles.includes(nextRole as typeof roles[number])) return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Invalid administrator role.' } });
  if (nextPlan && !plans.includes(nextPlan as typeof plans[number])) return res.status(400).json({ success: false, error: { code: 'INVALID_PLAN', message: 'Invalid account plan.' } });
  if (id === admin.id && nextRole && nextRole !== 'SUPER_ADMIN') return res.status(409).json({ success: false, error: { code: 'SELF_LOCKOUT_PREVENTED', message: 'You cannot remove your own SUPER_ADMIN role.' } });
  try {
    const current = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, adminRole: true, plan: true, emailVerified: true } });
    if (!current) return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    const updated = await prisma.user.update({ where: { id }, data: { ...(nextRole ? { adminRole: nextRole as any } : {}), ...(nextPlan ? { plan: nextPlan as any } : {}), ...(emailVerified === undefined ? {} : { emailVerified }) }, select: { id: true, email: true, name: true, plan: true, adminRole: true, emailVerified: true, twoFactorEnabled: true, createdAt: true, lastLoginAt: true } });
    await writeAdminAudit(admin.id, 'admin.user.updated', id, { email: current.email, from: { adminRole: current.adminRole, plan: current.plan, emailVerified: current.emailVerified }, to: { adminRole: updated.adminRole, plan: updated.plan, emailVerified: updated.emailVerified } });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin user update error:', error);
    return res.status(503).json({ success: false, error: { code: 'ADMIN_USER_UPDATE_UNAVAILABLE', message: 'User administration is temporarily unavailable.' } });
  }
}
