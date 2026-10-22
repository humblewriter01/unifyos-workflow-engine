import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../lib/admin-auth';
import { STATE_ACTIONS, listAdminEvents } from '../../../lib/admin-events';
import { clearAnnouncement, getActiveAnnouncement, isAnnouncementTone, publishAnnouncement } from '../../../lib/announcements';

/**
 * Dashboard announcement banner.
 *
 * GET    — current banner plus recent publications (any admin role).
 * POST   — publish: { message, tone?, expiresAt? }. SUPER_ADMIN only.
 * DELETE — clear the banner. SUPER_ADMIN only.
 */
const MAX_MESSAGE = 280;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const [current, history] = await Promise.all([
        getActiveAnnouncement(),
        listAdminEvents({ actions: [STATE_ACTIONS.announcement], limit: 15 }),
      ]);
      return res.status(200).json({ success: true, data: { current, history: history.items } });
    } catch (error) {
      console.error('Announcement read error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'ANNOUNCEMENT_UNAVAILABLE', message: 'Announcements are temporarily unavailable.' },
      });
    }
  }

  const admin = await requireAdmin(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  if (req.method === 'POST') {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ success: false, error: { code: 'MESSAGE_REQUIRED', message: 'An announcement message is required.' } });
    }
    if (message.length > MAX_MESSAGE) {
      return res.status(400).json({
        success: false,
        error: { code: 'MESSAGE_TOO_LONG', message: `Keep the banner under ${MAX_MESSAGE} characters.` },
      });
    }

    const tone = isAnnouncementTone(req.body?.tone) ? req.body.tone : 'info';

    let expiresAt: string | null = null;
    if (typeof req.body?.expiresAt === 'string' && req.body.expiresAt) {
      const parsed = new Date(req.body.expiresAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_EXPIRY', message: 'Expiry must be a future date, or left empty to run indefinitely.' },
        });
      }
      expiresAt = parsed.toISOString();
    }

    try {
      const announcement = await publishAnnouncement({ message, tone, expiresAt, actor: adminActor(admin), req });
      return res.status(201).json({ success: true, data: announcement, message: 'Announcement published.' });
    } catch (error) {
      console.error('Announcement publish error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'ANNOUNCEMENT_PUBLISH_UNAVAILABLE', message: 'The announcement could not be published.' },
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await clearAnnouncement({ actor: adminActor(admin), req });
      return res.status(200).json({ success: true, data: { current: null }, message: 'Announcement cleared.' });
    } catch (error) {
      console.error('Announcement clear error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'ANNOUNCEMENT_CLEAR_UNAVAILABLE', message: 'The announcement could not be cleared.' },
      });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
}
