import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';
import { verifyTransaction } from '../../../lib/paystack';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });
  const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
  if (!reference) return res.status(400).json({ success: false, error: { code: 'REFERENCE_REQUIRED', message: 'A payment reference is required.' } });

  try {
    const payment = await prisma.payment.findFirst({ where: { reference, userId }, select: { id: true, amount: true, currency: true, status: true, metadata: true } });
    if (!payment) return res.status(404).json({ success: false, error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' } });
    if (payment.status === 'SUCCESS') return res.status(200).json({ success: true, data: { status: 'SUCCESS' } });
    const provider = await verifyTransaction(reference);
    const verified = provider.data.status === 'success' && provider.data.amount === payment.amount && provider.data.currency === payment.currency;
    if (!verified) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: provider.data.status === 'failed' ? 'FAILED' : 'PENDING' } });
      return res.status(409).json({ success: false, error: { code: 'PAYMENT_NOT_VERIFIED', message: 'Payment is not verified for the expected amount and currency.' } });
    }
    const metadata = (payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}) as { planId?: string };
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', providerTransactionId: String(provider.data.id), verifiedAt: new Date() } });
      if (metadata.planId) {
        await tx.subscription.updateMany({ where: { userId, status: { in: ['ACTIVE', 'INCOMPLETE'] } }, data: { status: 'CANCELLED', canceledAt: new Date() } });
        await tx.subscription.create({ data: { userId, planId: metadata.planId, provider: 'paystack', status: 'ACTIVE', payments: { connect: { id: payment.id } } } });
      }
    });
    return res.status(200).json({ success: true, data: { status: 'SUCCESS' } });
  } catch {
    return res.status(502).json({ success: false, error: { code: 'PAYMENT_VERIFICATION_FAILED', message: 'Payment verification is temporarily unavailable.' } });
  }
}
