import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllIntegrationStatuses } from '../../lib/integrations';
import { isSupabaseConfigured } from '../../lib/supabase';
import prisma from '../../lib/prisma';
import { getEnv } from '../../lib/env';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  let database: 'operational' | 'unavailable' | 'not_configured' = 'not_configured';
  if (getEnv('DATABASE_URL')) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'operational';
    } catch (error) {
      console.warn('Health check database unavailable:', error instanceof Error ? error.message : error);
      database = 'unavailable';
    }
  }

  const integrations = getAllIntegrationStatuses();
  const healthy = database === 'operational';
  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      api: 'operational',
      database,
      data: isSupabaseConfigured ? 'configured' : 'not_configured',
      redis: 'not_configured',
    },
    integrations: Object.fromEntries(
      integrations.map((integration) => [integration.id, integration.configured ? 'configured' : 'available']),
    ),
  });
}
