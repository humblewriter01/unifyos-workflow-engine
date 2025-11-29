'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Inbox as InboxIcon, Loader2 } from 'lucide-react';
import { api, Notification } from '../lib/api';

export default function UnifiedInbox() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.notifications.getAll();
      setNotifications(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, unread: false } : n
      ));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, unread: false })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start space-x-4 p-4 rounded-lg bg-neutral-50 dark:bg-dark-700 border border-neutral-200 dark:border-dark-600 animate-pulse">
            <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-600 mt-2"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-neutral-200 dark:bg-dark-600 rounded w-1/4"></div>
              <div className="h-4 bg-neutral-200 dark:bg-dark-600 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 dark:text-red-400 mb-2">⚠️</div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
        <button
          onClick={loadNotifications}
          className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto bg-neutral-100 dark:bg-dark-700 rounded-full flex items-center justify-center mb-4">
          <InboxIcon className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          No notifications yet
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Notifications from your connected apps will appear here
        </p>
        <button className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
          Connect an app to get started →
        </button>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-dark-700">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors flex items-center space-x-1"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-start space-x-4 p-4 rounded-lg border transition-all cursor-pointer ${
              notification.unread 
                ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/20' 
                : 'bg-neutral-50 dark:bg-dark-700 border-neutral-200 dark:border-dark-600 hover:bg-neutral-100 dark:hover:bg-dark-600'
            }`}
            onClick={() => notification.unread && handleMarkAsRead(notification.id)}
          >
            <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
              notification.unread ? 'bg-primary-500' : 'bg-neutral-400 dark:bg-neutral-600'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-neutral-900 dark:text-white flex items-center space-x-2">
                  <span>{notification.icon}</span>
                  <span>{notification.app}</span>
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0 ml-2">
                  {notification.time}
                </span>
              </div>
              <p className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">
                {notification.message}
              </p>
              {notification.priority === 'high' && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium rounded">
                  High Priority
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {notifications.length >= 10 && (
        <div className="text-center pt-4">
          <button className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
            Load more notifications
          </button>
        </div>
      )}
    </div>
  );
}

// Location: apps/frontend/components/UnifiedInbox.tsx
// NO MOCK DATA - All data from API
