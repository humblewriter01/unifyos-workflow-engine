import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });
  try {
    const [subscription, payments] = await Promise.all([
      prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { status: true, cancelAtPeriodEnd: true, currentPeriodStart: true, currentPeriodEnd: true, plan: { select: { key: true, name: true } } } }),
      prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20, select: { reference: true, amount: true, currency: true, status: true, createdAt: true } }),
    ]);
    return res.status(200).json({ success: true, data: { subscription, payments } });
  } catch {
    return res.status(503).json({ success: false, error: { code: 'BILLING_UNAVAILABLE', message: 'Billing information is temporarily unavailable.' } });
  }
}
