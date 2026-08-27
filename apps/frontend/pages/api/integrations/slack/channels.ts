import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { getUserAppToken, markAppTokenUsed } from '../../../../lib/app-tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Sign in required.' });

  try {
    const token = await getUserAppToken(userId, 'slack');
    if (!token) return res.status(503).json({ success: false, error: 'Connect Slack before loading channels.', code: 'SLACK_NOT_CONNECTED' });
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);
    const response = await fetch(`https://slack.com/api/conversations.list?limit=${limit}&exclude_archived=true&types=public_channel,private_channel`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    await markAppTokenUsed(token.id);
    if (!response.ok || !payload.ok) return res.status(502).json({ success: false, error: payload.error || 'Slack channel request failed.' });
    return res.status(200).json({ success: true, data: (payload.channels || []).map((channel: any) => ({ id: channel.id, name: channel.name, isPrivate: Boolean(channel.is_private), isMember: Boolean(channel.is_member) })) });
  } catch (error) {
    console.error('Slack channels error:', error);
    return res.status(502).json({ success: false, error: 'Slack is temporarily unavailable.' });
  }
}
