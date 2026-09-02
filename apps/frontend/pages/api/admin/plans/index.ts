import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, writeAdminAudit } from '../../../../lib/admin-auth';
import prisma from '../../../../lib/prisma';

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result && result.length <= max ? result : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res, ['CATALOG_ADMIN', 'SUPER_ADMIN']);
  if (!admin) return;
  try {
    if (req.method === 'GET') {
      const plans = await prisma.billingPlan.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: { id: true, key: true, name: true, description: true, status: true, createdAt: true, updatedAt: true, prices: { orderBy: { version: 'desc' }, take: 10 }, entitlements: { include: { feature: true } } },
      });
      return res.status(200).json({ success: true, data: plans });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
    }
    const key = text(req.body?.key, 64);
    const name = text(req.body?.name, 120);
    const description = text(req.body?.description, 500);
    const amount = req.body?.amount;
    const currency = text(req.body?.currency, 3)?.toUpperCase();
    const interval = req.body?.interval;
    if (!key || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(key) || !name || !currency || !['MONTH', 'YEAR', 'ONE_TIME'].includes(interval) || !Number.isInteger(amount) || amount < 0 || amount > 2147483647) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PLAN', message: 'Provide a valid key, name, integer amount, ISO currency, and billing interval.' } });
    }
    const plan = await prisma.billingPlan.create({
      data: { key, name, description, status: 'DRAFT', prices: { create: { version: 1, amount, currency, interval, trialDays: 0 } } },
      include: { prices: true },
    });
    await writeAdminAudit(admin.id, 'billing.plan.created', plan.id, { key, version: 1 });
    return res.status(201).json({ success: true, data: plan });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'PLAN_EXISTS', message: 'A plan with that key already exists.' } });
    return res.status(503).json({ success: false, error: { code: 'ADMIN_BILLING_UNAVAILABLE', message: 'The catalog service is temporarily unavailable.' } });
  }
}
