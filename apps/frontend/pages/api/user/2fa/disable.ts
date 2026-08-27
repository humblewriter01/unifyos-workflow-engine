import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import { decryptAuthSecret } from '../../../../lib/auth-tokens';
import { checkRateLimit, getRequestIp } from '../../../../lib/rate-limit';
import { consumeRecoveryCode, verifyTotp } from '../../../../lib/two-factor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ success: false, error: 'Sign in required.' });
  const rate = checkRateLimit(`2fa-disable:${session.user.id}:${getRequestIp(req)}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({ success: false, error: 'Too many verification attempts. Please try again later.' });
  }

  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
    });
    if (!user) return res.status(401).json({ success: false, error: 'Sign in required.' });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return res.status(409).json({ success: false, error: 'Two-factor authentication is not enabled.' });

    const secret = decryptAuthSecret(user.twoFactorSecret);
    const validTotp = secret ? await verifyTotp(secret, code) : false;
    const recovery = validTotp ? { valid: false, remaining: [] as string[] } : await consumeRecoveryCode(code, user.twoFactorRecoveryCodes);
    if (!validTotp && !recovery.valid) return res.status(400).json({ success: false, error: 'That authenticator or recovery code is invalid.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: null },
    });
    return res.status(200).json({ success: true, message: 'Two-factor authentication has been disabled.' });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ success: false, error: 'Unable to disable two-factor authentication.' });
  }
}
