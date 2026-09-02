import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, writeAdminAudit } from '../../../../lib/admin-auth';
import prisma from '../../../../lib/prisma';

const transitions: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['SCHEDULED', 'PUBLISHED'],
  SCHEDULED: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['DEPRECATED'],
  DEPRECATED: ['ARCHIVED', 'PUBLISHED'],
  ARCHIVED: ['DRAFT'],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const admin = await requireAdmin(req, res, ['CATALOG_ADMIN', 'SUPER_ADMIN']);
  if (!admin) return;
  if (!id) return res.status(400).json({ success: false, error: { code: 'PLAN_ID_REQUIRED', message: 'Plan id is required.' } });
  try {
    const plan = await prisma.billingPlan.findUnique({ where: { id }, select: { id: true, status: true, key: true } });
    if (!plan) return res.status(404).json({ success: false, error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found.' } });
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'PATCH');
      return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
    }
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 500) return res.status(400).json({ success: false, error: { code: 'REASON_REQUIRED', message: 'A reason is required for catalog state changes.' } });
    if (!transitions[plan.status]?.includes(nextStatus)) return res.status(409).json({ success: false, error: { code: 'INVALID_PLAN_TRANSITION', message: `Cannot change a ${plan.status} plan to ${nextStatus}.` } });
    if (nextStatus === 'PUBLISHED' && admin.adminRole !== 'SUPER_ADMIN') return res.status(403).json({ success: false, error: { code: 'PUBLISH_APPROVAL_REQUIRED', message: 'Only a super administrator can publish a catalog plan.' } });
    const updated = await prisma.billingPlan.update({ where: { id }, data: { status: nextStatus as any } });
    await writeAdminAudit(admin.id, 'billing.plan.status_changed', id, { from: plan.status, to: nextStatus, reason });
    return res.status(200).json({ success: true, data: updated });
  } catch {
    return res.status(503).json({ success: false, error: { code: 'ADMIN_BILLING_UNAVAILABLE', message: 'The catalog service is temporarily unavailable.' } });
  }
}
