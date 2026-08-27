import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllIntegrationStatuses } from '../../lib/integrations';
import { isSupabaseConfigured } from '../../lib/supabase';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const integrations = getAllIntegrationStatuses();
  return res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      api: 'operational',
      database: process.env.DATABASE_URL ? 'configured' : 'not_configured',
      data: isSupabaseConfigured ? 'configured' : 'not_configured',
      redis: 'not_configured',
    },
    integrations: Object.fromEntries(
      integrations.map((integration) => [integration.id, integration.configured ? 'configured' : 'available']),
    ),
  });
}
