import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        data: [],
        meta: { total: 0, unread: 0, degraded: true, reason: 'Supabase is not configured' },
      });
    }
    return res.status(503).json({
      success: false,
      error: 'Notifications are unavailable until Supabase is configured.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    if (!userId) {
      return res.status(200).json({ success: true, data: [], meta: { total: 0, unread: 0 } });
    }

    if (req.method === 'GET') {
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('[Notifications] Table unavailable; returning empty list:', error.message);
        return res.status(200).json({ success: true, data: [], meta: { total: 0, unread: 0, degraded: true } });
      }

      const transformedNotifications = (notifications || []).map((notification: any) => ({
        id: notification.id,
        app: notification.app_name,
        message: notification.message,
        time: formatTimeAgo(new Date(notification.created_at)),
        unread: !notification.read,
        priority: notification.priority.toLowerCase() as 'high' | 'medium' | 'low',
        icon: notification.app_icon || '📬',
        timestamp: new Date(notification.created_at).getTime(),
      }));

      return res.status(200).json({
        success: true,
        data: transformedNotifications,
        meta: {
          total: transformedNotifications.length,
          unread: transformedNotifications.filter((notification) => notification.unread).length,
        },
      });
    }

    const { app, message, priority, icon } = req.body || {};
    const { data: newNotification, error: createError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        app_name: app || 'System',
        title: app || 'System',
        message: message || 'New notification',
        priority: priority?.toUpperCase() || 'MEDIUM',
        app_icon: icon || '📬',
        read: false,
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create notification:', createError);
      return res.status(500).json({ success: false, error: 'Failed to create notification' });
    }

    return res.status(201).json({
      success: true,
      data: {
        id: newNotification.id,
        app: newNotification.app_name,
        message: newNotification.message,
        time: 'just now',
        unread: !newNotification.read,
        priority: newNotification.priority.toLowerCase(),
        icon: newNotification.app_icon || '📬',
        timestamp: new Date(newNotification.created_at).getTime(),
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
    });
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''} ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}
