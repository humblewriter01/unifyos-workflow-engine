import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

// Available apps catalog
const AVAILABLE_APPS = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team messaging and collaboration',
    category: 'Communication',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send and receive emails',
    category: 'Communication',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Manage events and schedules',
    category: 'Productivity',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notes and documentation',
    category: 'Productivity',
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Project management boards',
    category: 'Project Management',
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Task and project tracking',
    category: 'Project Management',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM and sales tools',
    category: 'Sales & CRM',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Customer relationship management',
    category: 'Sales & CRM',
  },
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${method} Not Allowed`,
    });
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    if (!userId) {
      return res.status(200).json({
        success: true,
        data: AVAILABLE_APPS.map(app => ({
          ...app,
          icon: app.id,
          connected: false,
        })),
        meta: {
          total: AVAILABLE_APPS.length,
          connected: 0,
        },
      });
    }

    const { data: connectedTokens, error } = await supabase
      .from('app_tokens')
      .select('app_name, connected, created_at')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch app tokens:', error);
      return res.status(200).json({
        success: true,
        data: AVAILABLE_APPS.map(app => ({
          ...app,
          icon: app.id,
          connected: false,
        })),
        meta: {
          total: AVAILABLE_APPS.length,
          connected: 0,
        },
      });
    }

    const connectedMap = new Map<string, { connected: boolean; connectedAt: string }>(
      (connectedTokens || []).map((token: any) => [
        token.app_name.toLowerCase(),
        {
          connected: token.connected,
          connectedAt: new Date(token.created_at).toISOString().split('T')[0],
        }
      ])
    );

    const apps = AVAILABLE_APPS.map(app => {
      const connectionInfo = connectedMap.get(app.id);
      return {
        id: app.id,
        name: app.name,
        icon: app.id,
        description: app.description,
        category: app.category,
        connected: connectionInfo?.connected || false,
        connectedAt: connectionInfo?.connectedAt,
      };
    });

    const connectedCount = apps.filter(app => app.connected).length;

    return res.status(200).json({
      success: true,
      data: apps,
      meta: {
        total: apps.length,
        connected: connectedCount,
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch apps:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch apps',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
