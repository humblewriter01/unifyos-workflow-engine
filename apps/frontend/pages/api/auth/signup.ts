import { hash as bcryptHash } from 'bcryptjs';
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

  const rate = checkRateLimit(`signup:${getRequestIp(req)}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({ success: false, error: 'Too many signup attempts. Please try again later.' });
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

  if (!name || name.length > 100 || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ success: false, error: 'Enter a valid name and email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Password must be between 8 and 128 characters.' });
  }
  if (requireVerification && !isEmailConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Email verification was enabled but RESEND_API_KEY is missing.',
      code: 'EMAIL_NOT_CONFIGURED',
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcryptHash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: !requireVerification,
        plan: 'FREE',
      },
    });

    if (requireVerification) {
      const verificationToken = createAuthToken('email_verification', user.id, VERIFICATION_TTL_MS);
      await sendVerificationEmail(user.email, verificationToken);
    }

    return res.status(201).json({
      success: true,
      verificationRequired: requireVerification,
      message: requireVerification
        ? 'Account created successfully. Please check your email to verify it.'
        : 'Account created successfully. You can now sign in.',
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'An account with that email already exists.' });
    }
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create account',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
}
