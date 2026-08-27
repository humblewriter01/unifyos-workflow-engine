import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { createAuthToken } from '../../../lib/auth-tokens';
import { sendVerificationEmail } from '../../../lib/email';
import { isEmailConfigured } from '../../../lib/env';
import { checkRateLimit, getRequestIp } from '../../../lib/rate-limit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const rate = checkRateLimit(`resend-verification:${getRequestIp(req)}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  if (!isEmailConfigured()) {
    return res.status(503).json({ success: false, error: 'Email verification is not configured yet.', code: 'EMAIL_NOT_CONFIGURED' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerified: true } });
    if (user && !user.emailVerified) {
      const token = createAuthToken('email_verification', user.id, VERIFICATION_TTL_MS);
      await sendVerificationEmail(user.email, token);
    }
    return res.status(200).json({ success: true, message: 'If an unverified account exists, a new verification email has been sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ success: false, error: 'Unable to resend the verification email right now.' });
  }
}
