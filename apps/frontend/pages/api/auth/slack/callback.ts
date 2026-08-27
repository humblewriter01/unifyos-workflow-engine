import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '../[...nextauth]';
import prisma from '../../../../lib/prisma';
import { getAppBaseUrl, getIntegrationStatus } from '../../../../lib/integrations';

function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hexadecimal characters');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const status = getIntegrationStatus('slack');
  if (!status?.configured) {
    return res.redirect(`/apps?error=slack_not_configured&missing=${status?.missingEnv.join(',') || 'credentials'}`);
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.redirect('/auth/signup?error=sign_in_required');
  }

  const { code, error } = req.query;
  if (error) return res.redirect(`/apps?error=slack_auth_failed&message=${encodeURIComponent(String(error))}`);
  if (!code || typeof code !== 'string') return res.redirect('/apps?error=missing_code');

  try {
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${getAppBaseUrl()}/api/auth/slack/callback`,
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.ok || !tokenData.access_token) {
      throw new Error(tokenData.error || 'Failed to get Slack token');
    }

    const encryptedToken = encrypt(tokenData.access_token);
    await prisma.appToken.upsert({
      where: { userId_appName: { userId, appName: 'slack' } },
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

    return res.redirect('/apps?success=slack_connected');
  } catch (callbackError) {
    console.error('Slack OAuth error:', callbackError);
    return res.redirect('/apps?error=slack_connection_failed');
  }
}
