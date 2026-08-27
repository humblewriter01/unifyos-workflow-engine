import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { getAppBaseUrl, getIntegrationStatus } from '../../../../lib/integrations';
import { createOAuthState } from '../../../../lib/oauth';

function oauthUrl(appId: string, state: string): string | undefined {
  const callback = `${getAppBaseUrl()}/api/apps/${appId}/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: callback,
    state,
  });

  switch (appId) {
    case 'slack':
      params.set('client_id', process.env.SLACK_CLIENT_ID!);
      params.set('scope', 'channels:read,chat:write,users:read');
      return `https://slack.com/oauth/v2/authorize?${params}`;
    case 'gmail':
    case 'calendar':
      params.set('client_id', process.env.GOOGLE_CLIENT_ID!);
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
      params.set('scope', appId === 'gmail'
        ? 'openid email profile https://www.googleapis.com/auth/gmail.modify'
        : 'openid email profile https://www.googleapis.com/auth/calendar');
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    case 'notion':
      params.set('client_id', process.env.NOTION_CLIENT_ID!);
      params.set('owner', 'user');
      return `https://api.notion.com/v1/oauth/authorize?${params}`;
    case 'asana':
      params.set('client_id', process.env.ASANA_CLIENT_ID!);
      params.set('scope', 'default');
      return `https://app.asana.com/-/oauth_authorize?${params}`;
    case 'monday':
      params.set('client_id', process.env.MONDAY_CLIENT_ID!);
      params.set('scope', 'me:read boards:read boards:write');
      return `https://auth.monday.com/oauth2/authorize?${params}`;
    case 'hubspot':
      params.set('client_id', process.env.HUBSPOT_CLIENT_ID!);
      params.set('scope', 'crm.objects.contacts.read crm.objects.contacts.write');
      return `https://app.hubspot.com/oauth/authorize?${params}`;
    case 'salesforce':
      params.set('client_id', process.env.SALESFORCE_CLIENT_ID!);
      params.set('display', 'popup');
      return `https://login.salesforce.com/services/oauth2/authorize?${params}`;
    default:
      return undefined;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = String(req.query.id || '').toLowerCase();
  const status = getIntegrationStatus(appId);

  if (!status) return res.status(404).json({ success: false, error: `Unknown integration: ${appId}` });

  if (req.method === 'POST') {
    if (!status.configured) {
      return res.status(503).json({
        success: false,
        error: `${status.name} is not configured yet. Add the provider credentials to enable it.`,
        code: 'INTEGRATION_NOT_CONFIGURED',
        missingEnv: status.missingEnv,
      });
    }

    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Sign in before connecting an integration.' });
    }

    const state = createOAuthState(appId, userId);
    const authUrl = oauthUrl(appId, state);
    if (!authUrl) {
      return res.status(501).json({
        success: false,
        error: `${status.name} credentials are recognized, but its OAuth flow is not implemented yet.`,
        code: 'INTEGRATION_OAUTH_NOT_IMPLEMENTED',
      });
    }

    return res.status(200).json({
      success: true,
      data: { appId, authUrl, connected: false },
      message: `Continue to ${status.name} to authorize UnifyOS.`,
    });
  }

  if (req.method === 'DELETE') {
    return res.status(200).json({
      success: true,
      data: { appId, connected: false },
      message: `${status.name} disconnected successfully`,
    });
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
}
