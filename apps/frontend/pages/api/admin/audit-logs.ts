import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/admin-auth';
import { listAdminEvents, STATE_ACTIONS } from '../../../lib/admin-events';

/**
 * Audit trail feed.
 *
 * Reads `admin_audit_logs` newest-first with cursor pagination.
 * `includeState=0` hides the reserved singleton rows (kill switch,
 * announcement, support tickets) so the page shows only genuine admin actions.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const limit = Number(req.query.limit) || 50;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action : '';
  const targetType = typeof req.query.targetType === 'string' ? req.query.targetType : undefined;
  const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;

  try {
    const { items, nextCursor } = await listAdminEvents({
      limit,
      cursor,
      targetType,
      targetId,
      actions: action ? [action] : undefined,
    });

    return res.status(200).json({
      success: true,
      data: items,
      meta: { nextCursor, stateActions: Object.values(STATE_ACTIONS) },
    });
  } catch (error) {
    console.error('Admin audit log error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'ADMIN_AUDIT_UNAVAILABLE', message: 'The audit trail is temporarily unavailable.' },
    });
  }
}
