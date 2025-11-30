// apps/frontend/pages/api/auth/signup.ts
import { hash } from 'bcryptjs';
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
    const passwordHash = await hash(password, 12);

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

// apps/frontend/pages/api/user/profile.ts
import { getServerSession } from 'next-auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            plan: true,
            emailVerified: true,
            createdAt: true,
          },
        });
        return res.status(200).json(user);
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch profile' });
      }

    case 'PUT':
      try {
        const { name, bio } = req.body;
        const user = await prisma.user.update({
          where: { id: session.user.id },
          data: { name },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });
        return res.status(200).json(user);
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update profile' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// apps/frontend/pages/api/user/password.ts
import { compare, hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user?.passwordHash) {
      return res.status(400).json({ error: 'Cannot change password for OAuth accounts' });
    }

    const isValid = await compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await hash(newPassword, 12);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
}

// apps/frontend/pages/api/user/export.ts
import { getServerSession } from 'next-auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GDPR-compliant data export
    const [user, workflows, notifications, appTokens] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.workflow.findMany({
        where: { userId: session.user.id },
      }),
      prisma.notification.findMany({
        where: { userId: session.user.id },
      }),
      prisma.appToken.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          appName: true,
          connected: true,
          scope: true,
          metadata: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
    ]);

    const exportData = {
      user,
      workflows,
      notifications,
      appTokens,
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=unifyos-data-${session.user.id}.json`
    );

    return res.status(200).json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
}

// apps/frontend/pages/api/user/delete.ts
import { getServerSession } from 'next-auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GDPR-compliant account deletion
    // Cascade deletes handled by Prisma schema ON DELETE CASCADE
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
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
}
