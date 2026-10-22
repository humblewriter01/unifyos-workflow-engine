import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../lib/admin-auth';
import { getKillSwitch, setKillSwitch } from '../../../lib/platform-controls';
import { listAdminEvents, STATE_ACTIONS } from '../../../lib/admin-events';

/**
 * Global workflow kill switch.
 *
 * GET  — current state (+ recent toggles). Any admin role may read it.
 * POST — { enabled: boolean, reason?: string }. SUPER_ADMIN only.
 *
 * Every POST writes an audit row; the newest row *is* the state (see
 * lib/admin-events.ts). Turning the switch off requires SUPER_ADMIN as well —
 * pausing is fail-safe, but resuming must be deliberate.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const fresh = req.query.fresh === '1' || req.query.fresh === 'true';
      const [state, history] = await Promise.all([
        getKillSwitch({ fresh }),
        listAdminEvents({ actions: [STATE_ACTIONS.killSwitch], limit: 10 }),
      ]);
      return res.status(200).json({ success: true, data: { state, history: history.items } });
    } catch (error) {
      console.error('Kill switch read error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'KILL_SWITCH_UNAVAILABLE', message: 'The platform kill switch state could not be read.' },
      });
    }
  }

  if (req.method === 'POST') {
    const admin = await requireAdmin(req, res, ['SUPER_ADMIN']);
    if (!admin) return;

    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: '`enabled` must be a boolean.' },
      });
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null;

    if (enabled && !reason) {
      return res.status(400).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'A reason is required when pausing workflow execution.' },
      });
    }

    try {
      const state = await setKillSwitch({ enabled, reason, actor: adminActor(admin), req });
      return res.status(200).json({
        success: true,
        data: { state },
        message: enabled
          ? 'Workflow execution is paused platform-wide.'
          : 'Workflow execution resumed platform-wide.',
      });
    } catch (error) {
      console.error('Kill switch write error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'KILL_SWITCH_UNAVAILABLE', message: 'The platform kill switch could not be updated.' },
      });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
}
