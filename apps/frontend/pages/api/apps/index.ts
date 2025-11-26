import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  // TODO: Get real user ID from session
  const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - No user session',
    });
  }

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${method} Not Allowed`,
    });
  }

  try {
    // Get user's connected apps from database
    const connectedTokens = await prisma.appToken.findMany({
      where: { userId },
      select: {
        appName: true,
        connected: true,
        createdAt: true,
      },
    });

    // Create a map of connected apps
    const connectedMap = new Map(
      connectedTokens.map(token => [
        token.appName.toLowerCase(),
        {
          connected: token.connected,
          connectedAt: token.createdAt.toISOString().split('T')[0],
        }
      ])
    );

    // Merge with available apps catalog
    const apps = AVAILABLE_APPS.map(app => {
      const connectionInfo = connectedMap.get(app.id);
      return {
        id: app.id,
        name: app.name,
        icon: app.id, // Frontend maps this to Lucide icons
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
