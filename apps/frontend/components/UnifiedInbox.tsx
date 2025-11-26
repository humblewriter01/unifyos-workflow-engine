'use client';

import { useState } from 'react';
import { Search, Filter, Mail, MessageSquare, FileText, Calendar, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface Notification {
  id: number;
  app: string;
  message: string;
  time: string;
  unread: boolean;
  priority: 'high' | 'medium' | 'low';
  icon: 'mail' | 'message' | 'file' | 'calendar';
  timestamp: number;
}

const mockNotifications: Notification[] = [
  { 
    id: 1, 
    app: 'Slack', 
    message: 'New message in #general: "Team standup in 10 minutes"', 
    time: '2 min ago', 
    unread: true,
    priority: 'high',
    icon: 'message',
    timestamp: Date.now() - 120000,
  },
  { 
    id: 2, 
    app: 'Gmail', 
    message: 'Meeting confirmed: Project Kickoff with Design Team', 
    time: '15 min ago', 
    unread: true,
    priority: 'medium',
    icon: 'mail',
    timestamp: Date.now() - 900000,
  },
  { 
    id: 3, 
    app: 'Notion', 
    message: 'Document shared: Q4 Planning Strategy by Sarah Chen', 
    time: '1 hour ago', 
    unread: false,
    priority: 'low',
    icon: 'file',
    timestamp: Date.now() - 3600000,
  },
  { 
    id: 4, 
    app: 'Calendar', 
    message: 'Reminder: Team sync starting in 2 hours', 
    time: '2 hours ago', 
    unread: false,
    priority: 'medium',
    icon: 'calendar',
    timestamp: Date.now() - 7200000,
  },
  { 
    id: 5, 
    app: 'Trello', 
    message: 'Card moved to "In Progress": Update landing page copy', 
    time: '3 hours ago', 
    unread: true,
    priority: 'low',
    icon: 'file',
    timestamp: Date.now() - 10800000,
  },
];

const iconMap = {
  mail: Mail,
  message: MessageSquare,
  file: FileText,
  calendar: Calendar,
};

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
        <button
          onClick={handleMarkAllAsRead}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          Mark all as read
        </button>
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
            <p className="text-neutral-600 font-medium">No notifications found</p>
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
