import type { NextApiRequest, NextApiResponse } from 'next';

interface Notification {
  id: number;
  app: string;
  message: string;
  time: string;
  unread: boolean;
  priority: 'high' | 'medium' | 'low';
  icon: string;
  timestamp: number;
}

// In-memory storage (replace with database in production)
let notifications: Notification[] = [
  {
    id: 1,
    app: 'Slack',
    message: 'New message in #general: "Team standup in 10 minutes"',
    time: '2 min ago',
    unread: true,
    priority: 'high',
    icon: '💬',
    timestamp: Date.now() - 120000,
  },
  {
    id: 2,
    app: 'Gmail',
    message: 'Meeting confirmed: Project Kickoff with Design Team',
    time: '15 min ago',
    unread: true,
    priority: 'medium',
    icon: '📧',
    timestamp: Date.now() - 900000,
  },
  {
    id: 3,
    app: 'Notion',
    message: 'Document shared: Q4 Planning Strategy by Sarah Chen',
    time: '1 hour ago',
    unread: false,
    priority: 'low',
    icon: '📝',
    timestamp: Date.now() - 3600000,
  },
  {
    id: 4,
    app: 'Calendar',
    message: 'Reminder: Team sync starting in 2 hours',
    time: '2 hours ago',
    unread: false,
    priority: 'medium',
    icon: '📅',
    timestamp: Date.now() - 7200000,
  },
  {
    id: 5,
    app: 'Trello',
    message: 'Card moved to "In Progress": Update landing page copy',
    time: '3 hours ago',
    unread: true,
    priority: 'low',
    icon: '📋',
    timestamp: Date.now() - 10800000,
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      // Get all notifications
      return res.status(200).json({
        success: true,
        data: notifications,
        meta: {
          total: notifications.length,
          unread: notifications.filter(n => n.unread).length,
        },
      });

    case 'POST':
      // Create new notification (for testing)
      const newNotification: Notification = {
        id: Date.now(),
        app: req.body.app || 'System',
        message: req.body.message || 'New notification',
        time: 'just now',
        unread: true,
        priority: req.body.priority || 'medium',
        icon: req.body.icon || '📬',
        timestamp: Date.now(),
      };
      notifications.unshift(newNotification);
      return res.status(201).json({
        success: true,
        data: newNotification,
      });

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`,
      });
  }
}
