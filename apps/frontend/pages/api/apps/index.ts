import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { getIntegrationStatus } from '../../../lib/integrations';
import prisma from '../../../lib/prisma';

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
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      const apps = getCatalogApps();
      return res.status(200).json({ success: true, data: apps, meta: { total: apps.length, connected: 0, tokenStore: 'prisma' } });
    }

    const connectedTokens = await prisma.appToken.findMany({
      where: { userId },
      select: { appName: true, connected: true, createdAt: true },
    });
    const connectedMap = new Map<string, { connected: boolean; connectedAt?: string }>(
      connectedTokens.map((token) => [
        token.appName.toLowerCase(),
        { connected: token.connected, connectedAt: token.createdAt.toISOString().split('T')[0] },
      ]),
    );
    const apps = getCatalogApps(connectedMap);
    return res.status(200).json({
      success: true,
      data: apps,
      meta: { total: apps.length, connected: apps.filter((app) => app.connected).length, tokenStore: 'prisma' },
    });
  } catch (error) {
    console.error('Failed to fetch apps:', error);
    return res.status(503).json({ success: false, error: 'Unable to load connected apps right now.' });
  }
}
