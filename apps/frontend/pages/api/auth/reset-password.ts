import { hash as bcryptHash } from 'bcryptjs';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { verifyAuthToken } from '../../../lib/auth-tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const email = verifyAuthToken(token, 'password_reset');

  if (!email) return res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Password must be between 8 and 128 characters.' });
  }

  try {
    const passwordHash = await bcryptHash(password, 12);
    const result = await prisma.user.updateMany({ where: { email }, data: { passwordHash } });
    if (result.count !== 1) return res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
    return res.status(200).json({ success: true, message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: 'Unable to reset your password right now.' });
  }
}
