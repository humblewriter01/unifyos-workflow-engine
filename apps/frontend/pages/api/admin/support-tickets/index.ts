import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../../lib/admin-auth';
import { countSupportTickets, listSupportTickets } from '../../../../lib/support-tickets';

/**
 * Support ticket inbox.
 *
 * GET ?status=open|resolved|all&limit&cursor — newest first, cursor paginated.
 * Tickets are persisted by `pages/api/contact/support.ts` before that route
 * tries to email them, so nothing submitted through the contact form is lost.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const admin = await requireAdmin(req, res, ['SUPPORT_READONLY', 'SUPER_ADMIN']);
  if (!admin) return;

  const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'open';
  const status = statusRaw === 'open' || statusRaw === 'resolved' || statusRaw === 'all' ? statusRaw : 'open';
  const limit = Number(req.query.limit) || 50;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  try {
    const [page, counts] = await Promise.all([listSupportTickets({ status, limit, cursor }), countSupportTickets()]);
    return res.status(200).json({
      success: true,
      data: page.items,
      meta: { nextCursor: page.nextCursor, status, counts },
    });
  } catch (error) {
    console.error('Support ticket list error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'SUPPORT_TICKETS_UNAVAILABLE', message: 'The support inbox is temporarily unavailable.' },
    });
  }
}
