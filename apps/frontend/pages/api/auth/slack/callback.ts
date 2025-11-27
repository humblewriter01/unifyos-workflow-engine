import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import crypto from 'crypto';

// Encryption utilities
function encrypt(text: string): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { code, error, state } = req.query;

  // Handle OAuth errors
  if (error) {
    return res.redirect(`/apps?error=slack_auth_failed&message=${error}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/apps?error=missing_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/slack/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      throw new Error(tokenData.error || 'Failed to get Slack token');
    }

    // Get user session (implement your auth here)
    // For now, using a hardcoded user ID - REPLACE WITH REAL AUTH
    const userId = 'user_placeholder'; // TODO: Get from session

    // Encrypt the access token before storing
    const encryptedToken = encrypt(tokenData.access_token);

    // Store token in database
    await prisma.appToken.upsert({
      where: {
        userId_appName: {
          userId,
          appName: 'slack',
        },
      },
      update: {
        accessToken: encryptedToken,
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        scope: tokenData.scope,
        metadata: {
          team_id: tokenData.team?.id,
          team_name: tokenData.team?.name,
          user_id: tokenData.authed_user?.id,
          bot_user_id: tokenData.bot_user_id,
        },
        connected: true,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        appName: 'slack',
        accessToken: encryptedToken,
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        scope: tokenData.scope,
        metadata: {
          team_id: tokenData.team?.id,
          team_name: tokenData.team?.name,
          user_id: tokenData.authed_user?.id,
          bot_user_id: tokenData.bot_user_id,
        },
        connected: true,
      },
    });

    // Redirect back to apps page with success
    return res.redirect('/apps?success=slack_connected');
  } catch (error) {
    console.error('Slack OAuth error:', error);
    return res.redirect('/apps?error=slack_connection_failed');
  }
}
