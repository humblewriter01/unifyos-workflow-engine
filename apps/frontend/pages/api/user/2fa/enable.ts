import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import { decryptAuthSecret } from '../../../../lib/auth-tokens';
import { checkRateLimit, getRequestIp } from '../../../../lib/rate-limit';
import { generateRecoveryCodes, hashRecoveryCodes, verifyTotp } from '../../../../lib/two-factor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ success: false, error: 'Sign in required.' });

  const rate = checkRateLimit(`2fa-enable:${session.user.id}:${getRequestIp(req)}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({ success: false, error: 'Too many verification attempts. Please try again later.' });
  }

  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, twoFactorSecret: true, twoFactorEnabled: true } });
    if (!user) return res.status(401).json({ success: false, error: 'Sign in required.' });
    if (user.twoFactorEnabled) return res.status(409).json({ success: false, error: 'Two-factor authentication is already enabled.' });

    const secret = user.twoFactorSecret ? decryptAuthSecret(user.twoFactorSecret) : null;
    if (!secret || !(await verifyTotp(secret, code))) {
      return res.status(400).json({ success: false, error: 'That authenticator code is invalid or expired.' });
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryCodeHashes = await hashRecoveryCodes(recoveryCodes);
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: recoveryCodeHashes },
    });

    return res.status(200).json({ success: true, recoveryCodes, message: 'Two-factor authentication is now enabled.' });
  } catch (error) {
    console.error('2FA enable error:', error);
    return res.status(500).json({ success: false, error: 'Unable to enable two-factor authentication.' });
  }
}
