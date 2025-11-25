'use client';

import { useState } from 'react';

interface Notification {
  id: number;
  app: string;
  message: string;
  time: string;
  unread: boolean;
  priority: 'high' | 'medium' | 'low';
  icon: string;
}

const mockNotifications: Notification[] = [
  { 
    id: 1, 
    app: 'Slack', 
    message: 'New message in #general: "Team standup in 10 minutes"', 
    time: '2 min ago', 
    unread: true,
    priority: 'high',
    icon: '💬'
  },
  { 
    id: 2, 
    app: 'Gmail', 
    message: 'Meeting confirmed: Project Kickoff with Design Team', 
    time: '15 min ago', 
    unread: true,
    priority: 'medium',
    icon: '📧'
  },
  { 
    id: 3, 
    app: 'Notion', 
    message: 'Document shared: Q4 Planning Strategy by Sarah Chen', 
    time: '1 hour ago', 
    unread: false,
    priority: 'low',
    icon: '📝'
  },
  { 
    id: 4, 
    app: 'Calendar', 
    message: 'Reminder: Team sync starting in 2 hours', 
    time: '2 hours ago', 
    unread: false,
    priority: 'medium',
    icon: '📅'
  },
  { 
    id: 5, 
    app: 'Trello', 
    message: 'Card moved to "In Progress": Update landing page copy', 
    time: '3 hours ago', 
    unread: true,
    priority: 'low',
    icon: '📋'
  },
  { 
    id: 6, 
    app: 'Slack', 
    message: 'New message in #engineering: "Deployment successful"', 
    time: '4 hours ago', 
    unread: false,
    priority: 'low',
    icon: '💬'
  },
  { 
    id: 7, 
    app: 'Gmail', 
    message: 'Invoice received from Acme Corp - $4,500', 
    time: '5 hours ago', 
    unread: true,
    priority: 'high',
    icon: '📧'
  },
  { 
    id: 8, 
    app: 'Asana', 
    message: 'Task assigned to you: Review marketing materials', 
    time: '6 hours ago', 
    unread: false,
    priority: 'medium',
    icon: '✅'
  },
];

export default function UnifiedInbox() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filterApp, setFilterApp] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(5);

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

  const handleMarkAsRead = (id: number) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const handleMarkAsUnread = (id: number) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, unread: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, unread: false })));
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 5);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">All Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
              {unreadCount} unread
            </span>
          )}
        </div>
        <button
          onClick={handleMarkAllAsRead}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Mark all as read
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={filterApp}
            onChange={(e) => setFilterApp(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {apps.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              showUnreadOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread only
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {visibleNotifications.length > 0 ? (
          visibleNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start space-x-4 p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                notification.unread
                  ? 'bg-blue-50 border-blue-200'
                  : getPriorityColor(notification.priority)
              }`}
            >
              {/* Unread Indicator */}
              <div
                className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                  notification.unread ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />

              {/* App Icon */}
              <div className="text-2xl flex-shrink-0">{notification.icon}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">
                      {notification.app}
                    </span>
                    {notification.priority === 'high' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                        High Priority
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {notification.time}
                  </span>
                </div>
                <p className="text-gray-700 text-sm">{notification.message}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {notification.unread ? (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="Mark as read"
                  >
                    ✓
                  </button>
                ) : (
                  <button
                    onClick={() => handleMarkAsUnread(notification.id)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="Mark as unread"
                  >
                    ◯
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <span className="text-6xl">📭</span>
            <p className="text-gray-500 mt-4">No notifications found</p>
            {(searchQuery || filterApp !== 'All' || showUnreadOnly) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterApp('All');
                  setShowUnreadOnly(false);
                }}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Load More Button */}
      {visibleCount < filteredNotifications.length && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Load More ({filteredNotifications.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900 mb-1">
              💡 Pro Tip
            </div>
            <div className="text-sm text-gray-600">
              Connect more apps to see all your notifications in one place
            </div>
          </div>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm whitespace-nowrap">
            Connect Apps
          </button>
        </div>
      </div>
    </div>
  );
    }
