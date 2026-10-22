import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../../../lib/admin-auth';
import { resolveSupportTicket } from '../../../../../lib/support-tickets';

/** Marks a support ticket resolved (idempotent; the resolved state is stored in metadata). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const admin = await requireAdmin(req, res, ['SUPPORT_READONLY', 'SUPER_ADMIN']);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    return res.status(400).json({ success: false, error: { code: 'TICKET_ID_REQUIRED', message: 'A ticket id is required.' } });
  }

  try {
    const ticket = await resolveSupportTicket(id, adminActor(admin), req);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' } });
    }
    return res.status(200).json({ success: true, data: ticket, message: 'Ticket marked resolved.' });
  } catch (error) {
    console.error('Support ticket resolve error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'SUPPORT_TICKET_UPDATE_UNAVAILABLE', message: 'The ticket could not be updated.' },
    });
  }
}
