import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { getActiveAnnouncement } from '../../../lib/announcements';

/**
 * The banner every signed-in dashboard user sees.
 *
 * Session-gated: announcements are internal product messaging and are not
 * exposed to anonymous visitors. Failures degrade silently — a 200 with
 * `current: null` is what the layout expects, and a broken banner must never
 * block the page.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });
  }

  res.setHeader('Cache-Control', 'no-store');
  try {
    const current = await getActiveAnnouncement();
    return res.status(200).json({ success: true, data: { current } });
  } catch (error) {
    console.error('Announcement banner error:', error);
    return res.status(200).json({ success: true, data: { current: null } });
  }
}
