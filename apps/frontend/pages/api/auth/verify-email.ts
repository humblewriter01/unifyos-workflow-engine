import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { verifyAuthToken } from '../../../lib/auth-tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const userId = verifyAuthToken(token, 'email_verification');
  if (!userId) {
    return res.status(400).json({ success: false, error: 'This verification link is invalid or has expired.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, emailVerified: true } });
    if (!user) return res.status(400).json({ success: false, error: 'This verification link is invalid or has expired.' });

    if (!user.emailVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    return res.status(200).json({ success: true, message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ success: false, error: 'Unable to verify this email address right now.' });
  }
}
