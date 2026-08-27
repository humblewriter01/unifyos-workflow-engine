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

  const parent = req.body?.parent;
  const properties = req.body?.properties;
  const children = req.body?.children;
  if (!parent || typeof parent !== 'object' || (!parent.page_id && !parent.database_id) || !properties || typeof properties !== 'object') {
    return res.status(400).json({ success: false, error: 'A parent page_id or database_id and properties are required.' });
  }
  if (children !== undefined && !Array.isArray(children)) return res.status(400).json({ success: false, error: 'children must be an array when provided.' });

  try {
    const token = await getUserAppToken(userId, 'notion');
    if (!token) return res.status(503).json({ success: false, error: 'Connect Notion before creating pages.', code: 'NOTION_NOT_CONNECTED' });
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.accessToken}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent, properties, ...(children ? { children } : {}) }),
    });
    const payload = await response.json().catch(() => ({}));
    await markAppTokenUsed(token.id);
    if (!response.ok || payload.object === 'error') return res.status(502).json({ success: false, error: payload.message || 'Notion page creation failed.' });
    return res.status(201).json({ success: true, data: { id: payload.id, url: payload.url } });
  } catch (error) {
    console.error('Notion page creation error:', error);
    return res.status(502).json({ success: false, error: 'Notion is temporarily unavailable.' });
  }
}
