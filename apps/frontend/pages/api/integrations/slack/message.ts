import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { getUserAppToken, markAppTokenUsed } from '../../../../lib/app-tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Sign in required.' });

  const channel = typeof req.body?.channel === 'string' ? req.body.channel.trim() : '';
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!channel || !text || text.length > 4000) return res.status(400).json({ success: false, error: 'A channel and message of 1–4000 characters are required.' });

  try {
    const token = await getUserAppToken(userId, 'slack');
    if (!token) return res.status(503).json({ success: false, error: 'Connect Slack before sending messages.', code: 'SLACK_NOT_CONNECTED' });
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text }),
    });
    const payload = await response.json().catch(() => ({}));
    await markAppTokenUsed(token.id);
    if (!response.ok || !payload.ok) return res.status(502).json({ success: false, error: payload.error || 'Slack message request failed.' });
    return res.status(200).json({ success: true, data: { channel: payload.channel, timestamp: payload.ts } });
  } catch (error) {
    console.error('Slack message error:', error);
    return res.status(502).json({ success: false, error: 'Slack is temporarily unavailable.' });
  }
}
