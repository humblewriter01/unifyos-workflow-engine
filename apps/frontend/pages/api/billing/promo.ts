import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';
import { isPromoFailure, quotePromoCode } from '../../../lib/promo-codes';

/**
 * Quotes a promo code against a price *before* payment is started, so the
 * billing page can show the discounted total. The same validation runs again in
 * `initialize.ts`, which is the request that actually fixes the charged amount.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });
  }

  const priceId = typeof req.body?.priceId === 'string' ? req.body.priceId : '';
  const code = req.body?.code;
  if (!priceId) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_PRICE', message: 'A price is required.' } });
  }

  try {
    const price = await prisma.billingPrice.findFirst({
      where: { id: priceId, archivedAt: null, plan: { status: 'PUBLISHED' } },
      select: { amount: true, currency: true },
    });
    if (!price) {
      return res.status(404).json({ success: false, error: { code: 'PRICE_NOT_FOUND', message: 'That price is no longer available.' } });
    }

    const quote = await quotePromoCode({ code, amount: price.amount, currency: price.currency, userId });
    if (isPromoFailure(quote)) {
      return res.status(409).json({ success: false, error: { code: quote.code, message: quote.message } });
    }

    return res.status(200).json({
      success: true,
      data: { ...quote.quote, originalAmount: price.amount },
    });
  } catch (error) {
    console.error('Promo quote error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'PROMO_QUOTE_UNAVAILABLE', message: 'Promo codes are temporarily unavailable.' },
    });
  }
}
