import { Notification } from '../types';

const mockNotifications: Notification[] = [
  { 
    id: 1, 
    app: 'Slack', 
    message: 'New message in #general', 
    time: '2 min ago', 
    unread: true 
  },
  { 
    id: 2, 
    app: 'Gmail', 
    message: 'Meeting confirmed: Project Kickoff', 
    time: '15 min ago', 
    unread: true 
  },
  { 
    id: 3, 
    app: 'Notion', 
    message: 'Document shared: Q4 Planning', 
    time: '1 hour ago', 
    unread: false 
  },
  { 
    id: 4, 
    app: 'Calendar', 
    message: 'Team sync starting soon', 
    time: '2 hours ago', 
    unread: false 
  },
];

export default function UnifiedInbox() {
  return (
    <div className="space-y-4">
      {mockNotifications.map((notification: Notification) => (
        <div
          key={notification.id}
          className={`flex items-start space-x-4 p-4 rounded-lg border ${
            notification.unread 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className={`w-3 h-3 rounded-full mt-2 ${
            notification.unread ? 'bg-blue-500' : 'bg-gray-400'
          }`} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{notification.app}</span>
              <span className="text-sm text-gray-500">{notification.time}</span>
            </div>
            <p className="text-gray-700 mt-1">{notification.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
