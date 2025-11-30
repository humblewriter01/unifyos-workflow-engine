// apps/frontend/pages/api/auth/signup.ts
import { hash as bcryptHash } from 'bcryptjs';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { sendVerificationEmail } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcryptHash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: false,
        plan: 'FREE',
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.id);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify.',
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

// apps/frontend/lib/email.ts (Email utility)
export async function sendVerificationEmail(email: string, userId: string) {
  // TODO: Implement email sending with your provider (SendGrid, AWS SES, etc.)
  const verificationLink = `${process.env.NEXTAUTH_URL}/api/auth/verify?token=${userId}`;
  
  console.log(`Send verification email to ${email}: ${verificationLink}`);
  
  // Example with SendGrid:
  // await sendgrid.send({
  //   to: email,
  //   from: 'noreply@unifyos.com',
  //   subject: 'Verify your UnifyOS account',
  //   html: `<a href="${verificationLink}">Verify Email</a>`,
  // });
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;
  console.log(`Send password reset email to ${email}: ${resetLink}`);
  
  // Example with SendGrid:
  // await sendgrid.send({
  //   to: email,
  //   from: 'noreply@unifyos.com',
  //   subject: 'Reset your UnifyOS password',
  //   html: `<a href="${resetLink}">Reset Password</a>`,
  // });
}
