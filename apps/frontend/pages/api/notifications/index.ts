import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  // TODO: Get real user ID from session
  const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - No user session',
    });
  }

  switch (method) {
    case 'GET':
      try {
        // Get real notifications from database
        const notifications = await prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 50, // Limit to most recent 50
        });

        // Transform to frontend format
        const transformedNotifications = notifications.map(n => ({
          id: n.id,
          app: n.appName,
          message: n.message,
          time: formatTimeAgo(n.createdAt),
          unread: !n.read,
          priority: n.priority.toLowerCase() as 'high' | 'medium' | 'low',
          icon: n.appIcon || '📬',
          timestamp: n.createdAt.getTime(),
        }));

        return res.status(200).json({
          success: true,
          data: transformedNotifications,
          meta: {
            total: transformedNotifications.length,
            unread: transformedNotifications.filter(n => n.unread).length,
          },
        });
      } catch (error: any) {
        console.error('Failed to fetch notifications:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notifications',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }

    case 'POST':
      try {
        // Create new notification (for testing or webhook handlers)
        const { app, message, priority, icon } = req.body;

        const notification = await prisma.notification.create({
          data: {
            userId,
            appName: app || 'System',
            message: message || 'New notification',
            priority: priority?.toUpperCase() || 'MEDIUM',
            appIcon: icon || '📬',
            read: false,
          },
        });

        return res.status(201).json({
          success: true,
          data: {
            id: notification.id,
            app: notification.appName,
            message: notification.message,
            time: 'just now',
            unread: !notification.read,
            priority: notification.priority.toLowerCase(),
            icon: notification.appIcon || '📬',
            timestamp: notification.createdAt.getTime(),
          },
        });
      } catch (error: any) {
        console.error('Failed to create notification:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to create notification',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`,
      });
  }
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''} ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

// Location: apps/frontend/pages/api/notifications/index.ts
// REAL DATABASE QUERIES - NO MOCK DATA
