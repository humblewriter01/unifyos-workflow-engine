import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ success: false, error: 'Sign in required.' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true, twoFactorRecoveryCodes: true },
    });
    if (!user) return res.status(401).json({ success: false, error: 'Sign in required.' });

    const recoveryCodes = Array.isArray(user.twoFactorRecoveryCodes) ? user.twoFactorRecoveryCodes.length : 0;
    return res.status(200).json({ success: true, enabled: user.twoFactorEnabled, recoveryCodesRemaining: recoveryCodes });
  } catch (error) {
    console.error('2FA status error:', error);
    return res.status(500).json({ success: false, error: 'Unable to load two-factor status.' });
  }
}
