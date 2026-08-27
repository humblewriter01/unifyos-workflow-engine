import { compare, hash } from 'bcryptjs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';
import { checkRateLimit, getRequestIp } from '../../../lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ success: false, error: 'Sign in required.' });

  const rate = checkRateLimit(`password-change:${session.user.id}:${getRequestIp(req)}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({ success: false, error: 'Too many attempts. Please try again later.' });
  }

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ success: false, error: 'New password must be between 8 and 128 characters.' });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, passwordHash: true } });
    if (!user?.passwordHash || !(await compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(newPassword, 12) } });
    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ success: false, error: 'Unable to update your password right now.' });
  }
}
