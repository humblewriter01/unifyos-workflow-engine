import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';
import { getEnv } from '../../../lib/env';
import { getAppBaseUrl } from '../../../lib/app-url';
import { initializeTransaction } from '../../../lib/paystack';
import { isPromoFailure, quotePromoCode } from '../../../lib/promo-codes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });

  if (getEnv('BILLING_ENABLED') !== 'true') return res.status(503).json({ success: false, error: { code: 'BILLING_DISABLED', message: 'Billing is not enabled for this environment.' } });
  const priceId = typeof req.body?.priceId === 'string' ? req.body.priceId : '';
  if (!priceId) return res.status(400).json({ success: false, error: { code: 'INVALID_PRICE', message: 'A price is required.' } });

  try {
    const [user, price] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
      prisma.billingPrice.findFirst({ where: { id: priceId, archivedAt: null, plan: { status: 'PUBLISHED' } }, include: { plan: true } }),
    ]);
    if (!user || !price) return res.status(404).json({ success: false, error: { code: 'PRICE_NOT_FOUND', message: 'That price is no longer available.' } });
    if (price.amount <= 0 || !Number.isInteger(price.amount)) return res.status(409).json({ success: false, error: { code: 'PRICE_INVALID', message: 'The selected price is not payable.' } });

    // A promo code changes the amount actually charged, so it is resolved here
    // (the single source of truth) and the discounted amount is what gets
    // stored on the payment. `verify.ts` then compares Paystack's amount with
    // this stored, already-discounted value.
    let promoCode: string | null = null;
    let discountAmount = 0;
    let amount = price.amount;
    if (typeof req.body?.promoCode === 'string' && req.body.promoCode.trim()) {
      const quote = await quotePromoCode({ code: req.body.promoCode, amount: price.amount, currency: price.currency, userId });
      if (isPromoFailure(quote)) {
        return res.status(409).json({ success: false, error: { code: quote.code, message: quote.message } });
      }
      promoCode = quote.quote.code;
      discountAmount = quote.quote.discountAmount;
      amount = quote.quote.finalAmount;
    }

    await prisma.billingCustomer.upsert({
      where: { userId },
      create: { userId, email: user.email },
      update: { email: user.email },
    });
    const reference = `unifyos_${randomUUID().replace(/-/g, '')}`;
    const payment = await prisma.payment.create({
      data: {
        userId,
        provider: 'paystack',
        reference,
        amount,
        currency: price.currency,
        metadata: {
          priceId,
          planId: price.planId,
          ...(promoCode ? { promoCode, discountAmount, originalAmount: price.amount } : {}),
        },
      },
    });

    // Derive from the current request so Paystack returns the customer to the
    // origin they are actually using. A stale NEXTAUTH_URL (or a missing value
    // on Vercel) previously sent paying customers to http://localhost:3000.
    const baseUrl = getAppBaseUrl(req);
    const provider = await initializeTransaction({
      email: user.email,
      amount,
      currency: price.currency,
      reference,
      callback_url: `${baseUrl}/billing?reference=${encodeURIComponent(reference)}`,
      metadata: { paymentId: payment.id, priceId, planId: price.planId, userId, ...(promoCode ? { promoCode } : {}) },
    });
    return res.status(201).json({
      success: true,
      data: {
        paymentId: payment.id,
        reference,
        authorizationUrl: provider.data.authorization_url,
        accessCode: provider.data.access_code,
        amount,
        discountAmount,
        promoCode,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYSTACK_NOT_CONFIGURED') return res.status(503).json({ success: false, error: { code: 'PAYSTACK_NOT_CONFIGURED', message: 'Payments are not configured for this environment.' } });
    return res.status(502).json({ success: false, error: { code: 'PAYMENT_INITIALIZATION_FAILED', message: 'Payment initialization failed. No access has been granted.' } });
  }
}
