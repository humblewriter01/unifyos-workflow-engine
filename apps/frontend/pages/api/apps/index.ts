import type { NextApiRequest, NextApiResponse } from 'next';

interface App {
  id: string;
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  category: string;
  connectedAt?: string;
}

// In-memory storage (replace with database in production)
let apps: App[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    description: 'Send and receive emails',
    connected: true,
    category: 'Communication',
    connectedAt: '2024-01-15',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Team messaging and collaboration',
    connected: true,
    category: 'Communication',
    connectedAt: '2024-01-20',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Manage events and schedules',
    connected: true,
    category: 'Productivity',
    connectedAt: '2024-01-18',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    description: 'Notes and documentation',
    connected: false,
    category: 'Productivity',
  },
  {
    id: 'trello',
    name: 'Trello',
    icon: '📋',
    description: 'Project management boards',
    connected: false,
    category: 'Project Management',
  },
  {
    id: 'asana',
    name: 'Asana',
    icon: '✅',
    description: 'Task and project tracking',
    connected: false,
    category: 'Project Management',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: '🎯',
    description: 'CRM and sales tools',
    connected: false,
    category: 'Sales & CRM',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    description: 'Customer relationship management',
    connected: false,
    category: 'Sales & CRM',
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      // Get all apps
      const connectedCount = apps.filter(app => app.connected).length;
      return res.status(200).json({
        success: true,
        data: apps,
        meta: {
          total: apps.length,
          connected: connectedCount,
        },
      });

    default:
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`,
      });
  }
}
