import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { getUserAppToken, markAppTokenUsed } from '../../../../lib/app-tokens';

const NOTION_VERSION = '2026-03-11';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Sign in required.' });

  const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 200) : '';
  try {
    const token = await getUserAppToken(userId, 'notion');
    if (!token) return res.status(503).json({ success: false, error: 'Connect Notion before searching.', code: 'NOTION_NOT_CONNECTED' });
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.accessToken}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, page_size: 100 }),
    });
    const payload = await response.json().catch(() => ({}));
    await markAppTokenUsed(token.id);
    if (!response.ok || payload.object === 'error') return res.status(502).json({ success: false, error: payload.message || 'Notion search failed.' });
    return res.status(200).json({ success: true, data: (payload.results || []).map((item: any) => ({ id: item.id, object: item.object, url: item.url, title: item.properties?.title?.title?.[0]?.plain_text || item.properties?.Name?.title?.[0]?.plain_text || null })) });
  } catch (error) {
    console.error('Notion search error:', error);
    return res.status(502).json({ success: false, error: 'Notion is temporarily unavailable.' });
  }
}
