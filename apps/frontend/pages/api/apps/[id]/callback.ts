import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import { getAppBaseUrl, getIntegrationStatus } from '../../../../lib/integrations';
import { encryptToken, verifyOAuthState } from '../../../../lib/oauth';
import { getEnv } from '../../../../lib/env';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  [key: string]: unknown;
};

function formBody(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

async function exchangeCode(appId: string, code: string, redirectUri: string): Promise<TokenResponse> {
  if (appId === 'notion') {
    const credentials = Buffer.from(`${getEnv('NOTION_CLIENT_ID')}:${getEnv('NOTION_CLIENT_SECRET')}`).toString('base64');
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    return parseTokenResponse(response);
  }

  const config: Record<string, { url: string; values: Record<string, string> }> = {
    slack: {
      url: 'https://slack.com/api/oauth.v2.access',
      values: {
        client_id: getEnv('SLACK_CLIENT_ID')!,
        client_secret: getEnv('SLACK_CLIENT_SECRET')!,
        code,
        redirect_uri: redirectUri,
      },
    },
    gmail: {
      url: 'https://oauth2.googleapis.com/token',
      values: {
        client_id: getEnv('GOOGLE_CLIENT_ID')!,
        client_secret: getEnv('GOOGLE_CLIENT_SECRET')!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    },
    calendar: {
      url: 'https://oauth2.googleapis.com/token',
      values: {
        client_id: getEnv('GOOGLE_CLIENT_ID')!,
        client_secret: getEnv('GOOGLE_CLIENT_SECRET')!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    },
    asana: {
      url: 'https://app.asana.com/-/oauth_token',
      values: {
        client_id: getEnv('ASANA_CLIENT_ID')!,
        client_secret: getEnv('ASANA_CLIENT_SECRET')!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    },
    monday: {
      url: 'https://auth.monday.com/oauth2/token',
      values: {
        client_id: getEnv('MONDAY_CLIENT_ID')!,
        client_secret: getEnv('MONDAY_CLIENT_SECRET')!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    },
    hubspot: {
      url: 'https://api.hubapi.com/oauth/v1/token',
      values: {
        client_id: getEnv('HUBSPOT_CLIENT_ID')!,
        client_secret: getEnv('HUBSPOT_CLIENT_SECRET')!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    },
    salesforce: {
      url: 'https://login.salesforce.com/services/oauth2/token',
      values: {
        client_id: getEnv('SALESFORCE_CLIENT_ID')!,
        client_secret: getEnv('SALESFORCE_CLIENT_SECRET')!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    },
  };

  const provider = config[appId];
  if (!provider) throw new Error(`OAuth callback is not implemented for ${appId}`);

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody(provider.values),
  });
  return parseTokenResponse(response);
}

async function parseTokenResponse(response: Response): Promise<TokenResponse> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token || payload.ok === false) {
    throw new Error(String(payload.error || payload.error_description || response.statusText || 'OAuth token exchange failed'));
  }
  return payload as TokenResponse;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const appId = String(req.query.id || '').toLowerCase();
  const status = getIntegrationStatus(appId);
  if (!status) return res.redirect('/apps?error=unknown_integration');
  if (!status.configured) return res.redirect(`/apps?error=${appId}_not_configured`);

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const providerError = typeof req.query.error === 'string' ? req.query.error : undefined;
  if (providerError) return res.redirect(`/apps?error=${appId}_auth_failed`);
  if (!code || !state) return res.redirect(`/apps?error=${appId}_missing_callback_data`);

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId || !verifyOAuthState(state, appId, userId)) {
    return res.redirect('/apps?error=invalid_oauth_state');
  }

  try {
    const redirectUri = appId === 'notion'
      ? getEnv('NOTION_REDIRECT_URI') || `${getAppBaseUrl()}/api/apps/notion/callback`
      : `${getAppBaseUrl()}/api/apps/${appId}/callback`;
    const token = await exchangeCode(appId, code, redirectUri);
    const accessToken = token.access_token;
    if (!accessToken) throw new Error('Provider did not return an access token');

    await prisma.appToken.upsert({
      where: { userId_appName: { userId, appName: appId } },
      update: {
        accessToken: encryptToken(accessToken),
        refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
        expiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null,
        scope: typeof token.scope === 'string' ? token.scope : null,
        metadata: { provider: appId, tokenType: token.token_type || null },
        connected: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        appName: appId,
        accessToken: encryptToken(accessToken),
        refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
        expiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null,
        scope: typeof token.scope === 'string' ? token.scope : null,
        metadata: { provider: appId, tokenType: token.token_type || null },
        connected: true,
      },
    });

    return res.redirect(`/apps?success=${appId}_connected`);
  } catch (error) {
    console.error(`[OAuth:${appId}] callback failed:`, error);
    return res.redirect(`/apps?error=${appId}_connection_failed`);
  }
}
