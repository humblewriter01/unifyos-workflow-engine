'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, Mail, MessageSquare, FileText, Calendar, CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react';

interface Notification {
  id: string;
  app: string;
  message: string;
  time: string;
  unread: boolean;
  priority: 'high' | 'medium' | 'low';
  icon: 'mail' | 'message' | 'file' | 'calendar';
  timestamp: number;
}

const iconMap = {
  mail: Mail,
  message: MessageSquare,
  file: FileText,
  calendar: Calendar,
};

export default function UnifiedInbox() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Fetch REAL notifications from API
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/notifications');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load notifications');
      }

      setNotifications(result.data || []);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const apps = ['All', ...Array.from(new Set(notifications.map((n) => n.app)))];
  const unreadCount = notifications.filter((n) => n.unread).length;

  const filteredNotifications = notifications
    .filter((n) => filterApp === 'All' || n.app === filterApp)
    .filter((n) => !showUnreadOnly || n.unread)
    .filter((n) => 
      n.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.app.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const visibleNotifications = filteredNotifications.slice(0, visibleCount);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, unread: false } : n))
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAsUnread = async (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, unread: true } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      });
      
      setNotifications(notifications.map((n) => ({ ...n, unread: false })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-amber-500';
      default:
        return 'border-l-neutral-300';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-lg p-4 animate-pulse">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-neutral-200 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              onClick={loadNotifications}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-semibold text-neutral-900">All Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadNotifications}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Mark all as read
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400 pointer-events-none" />
            <select
              value={filterApp}
              onChange={(e) => setFilterApp(e.target.value)}
              className="pl-10 pr-8 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white appearance-none cursor-pointer"
            >
              {apps.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              showUnreadOnly
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            Unread only
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {visibleNotifications.length > 0 ? (
          visibleNotifications.map((notification) => {
            const IconComponent = iconMap[notification.icon];
            
            return (
              <div
                key={notification.id}
                className={`
                  flex items-start space-x-4 p-4 rounded-lg border-l-2 
                  transition-all hover:shadow-sm cursor-pointer
                  ${notification.unread ? 'bg-primary-50/30 border-neutral-200' : 'bg-white border-neutral-200'}
                  ${getPriorityStyles(notification.priority)}
                `}
              >
                {/* Icon */}
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                  ${notification.unread ? 'bg-primary-100' : 'bg-neutral-100'}
                `}>
                  <IconComponent className={`w-5 h-5 ${notification.unread ? 'text-primary-600' : 'text-neutral-500'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {notification.app}
                      </span>
                      {notification.priority === 'high' && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed">{notification.message}</p>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0">
                  {notification.unread ? (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="p-1.5 text-neutral-400 hover:text-primary-600 transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkAsUnread(notification.id)}
                      className="p-1.5 text-neutral-400 hover:text-primary-600 transition-colors"
                      title="Mark as unread"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-600 font-medium">No notifications yet</p>
            <p className="text-sm text-neutral-500 mt-1">Connect apps to start receiving notifications</p>
            {(searchQuery || filterApp !== 'All' || showUnreadOnly) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterApp('All');
                  setShowUnreadOnly(false);
                }}
                className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Load More */}
      {visibleCount < filteredNotifications.length && (
        <div className="text-center pt-2">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors text-sm font-medium"
          >
            Load More ({filteredNotifications.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
