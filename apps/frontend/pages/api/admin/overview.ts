import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/admin-auth';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const [users, workflows, connectedApps, plans, subscriptions, payments, audit] = await Promise.all([
      prisma.user.count(),
      prisma.workflow.count(),
      prisma.appToken.count({ where: { connected: true } }),
      prisma.billingPlan.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.count({ where: { status: 'SUCCESS' } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, userId: true, action: true, resource: true, metadata: true, createdAt: true } }),
    ]);
    return res.status(200).json({ success: true, data: { metrics: { users, workflows, connectedApps, plans, activeSubscriptions: subscriptions, successfulPayments: payments }, audit } });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(503).json({ success: false, error: { code: 'ADMIN_OVERVIEW_UNAVAILABLE', message: 'The admin overview is temporarily unavailable.' } });
  }
}
