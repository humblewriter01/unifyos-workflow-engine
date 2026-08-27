import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { getIntegrationStatus } from '../../../lib/integrations';
import { supabase } from '../../../lib/supabase';

const AVAILABLE_APPS = [
  { id: 'slack', name: 'Slack', description: 'Team messaging and collaboration', category: 'Communication' },
  { id: 'gmail', name: 'Gmail', description: 'Send and receive emails', category: 'Communication' },
  { id: 'calendar', name: 'Google Calendar', description: 'Manage events and schedules', category: 'Productivity' },
  { id: 'notion', name: 'Notion', description: 'Notes and documentation', category: 'Productivity' },
  { id: 'trello', name: 'Trello', description: 'Project management boards', category: 'Project Management' },
  { id: 'asana', name: 'Asana', description: 'Task and project tracking', category: 'Project Management' },
  { id: 'hubspot', name: 'HubSpot', description: 'CRM and sales tools', category: 'Sales & CRM' },
  { id: 'salesforce', name: 'Salesforce', description: 'Customer relationship management', category: 'Sales & CRM' },
  { id: 'monday', name: 'Monday.com', description: 'Work management and team collaboration', category: 'Project Management' },
] as const;

function getCatalogApps(connectedMap = new Map<string, { connected: boolean; connectedAt?: string }>()) {
  return AVAILABLE_APPS.map((app) => {
    const status = getIntegrationStatus(app.id);
    const connectionInfo = connectedMap.get(app.id);
    return {
      ...app,
      icon: app.id,
      configured: status?.configured ?? false,
      connected: connectionInfo?.connected ?? false,
      connectedAt: connectionInfo?.connectedAt,
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabase) {
      const apps = getCatalogApps();
      return res.status(200).json({
        success: true,
        data: apps,
        meta: { total: apps.length, connected: 0, supabaseConfigured: false },
      });
    }

    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      const apps = getCatalogApps();
      return res.status(200).json({
        success: true,
        data: apps,
        meta: { total: apps.length, connected: 0, supabaseConfigured: true },
      });
    }

    const { data: connectedTokens, error } = await supabase
      .from('app_tokens')
      .select('app_name, connected, created_at')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch app tokens:', error);
      const apps = getCatalogApps();
      return res.status(200).json({
        success: true,
        data: apps,
        meta: { total: apps.length, connected: 0, supabaseConfigured: true },
      });
    }

    const connectedMap = new Map<string, { connected: boolean; connectedAt?: string }>(
      (connectedTokens || []).map((token: { app_name: string; connected: boolean; created_at: string }) => [
        token.app_name.toLowerCase(),
        {
          connected: token.connected,
          connectedAt: token.created_at ? new Date(token.created_at).toISOString().split('T')[0] : undefined,
        },
      ]),
    );
    const apps = getCatalogApps(connectedMap);
    const connectedCount = apps.filter((app) => app.connected).length;

    return res.status(200).json({
      success: true,
      data: apps,
      meta: { total: apps.length, connected: connectedCount, supabaseConfigured: true },
    });
  } catch (error) {
    console.error('Failed to fetch apps:', error);
    return res.status(200).json({
      success: true,
      data: getCatalogApps(),
      meta: { total: AVAILABLE_APPS.length, connected: 0, supabaseConfigured: Boolean(supabase) },
    });
  }
}
