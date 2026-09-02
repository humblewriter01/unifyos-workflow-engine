import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  try {
    const plans = await prisma.billingPlan.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        prices: {
          where: { archivedAt: null },
          orderBy: { version: 'desc' },
          take: 3,
          select: { id: true, version: true, amount: true, currency: true, interval: true, trialDays: true, effectiveAt: true },
        },
        entitlements: { select: { limit: true, feature: { select: { key: true, name: true, description: true } } } },
      },
    });
    return res.status(200).json({ success: true, data: plans });
  } catch {
    return res.status(503).json({ success: false, error: { code: 'BILLING_UNAVAILABLE', message: 'Billing plans are temporarily unavailable.' } });
  }
}
