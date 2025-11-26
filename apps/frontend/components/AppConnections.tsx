'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Calendar, FileText, Trello, CheckSquare, Target, Cloud, Check, X, Settings2 } from 'lucide-react';

interface App {
  id: string;
  name: string;
  icon: any;
  description: string;
  connected: boolean;
  category: string;
}

const iconMap: Record<string, any> = {
  gmail: Mail,
  slack: MessageSquare,
  calendar: Calendar,
  notion: FileText,
  trello: Trello,
  asana: CheckSquare,
  hubspot: Target,
  salesforce: Cloud,
};

const availableApps: App[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: iconMap.gmail,
    description: 'Send and receive emails',
    connected: true,
    category: 'Communication',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: iconMap.slack,
    description: 'Team messaging and collaboration',
    connected: true,
    category: 'Communication',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: iconMap.calendar,
    description: 'Manage events and schedules',
    connected: true,
    category: 'Productivity',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: iconMap.notion,
    description: 'Notes and documentation',
    connected: false,
    category: 'Productivity',
  },
  {
    id: 'trello',
    name: 'Trello',
    icon: iconMap.trello,
    description: 'Project management boards',
    connected: false,
    category: 'Project Management',
  },
  {
    id: 'asana',
    name: 'Asana',
    icon: iconMap.asana,
    description: 'Task and project tracking',
    connected: false,
    category: 'Project Management',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: iconMap.hubspot,
    description: 'CRM and sales tools',
    connected: false,
    category: 'Sales & CRM',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: iconMap.salesforce,
    description: 'Customer relationship management',
    connected: false,
    category: 'Sales & CRM',
  },
];

export default function AppConnections() {
  const [apps, setApps] = useState<App[]>(availableApps);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);

  const categories = ['All', ...Array.from(new Set(apps.map((app) => app.category)))];
  
  const filteredApps = selectedCategory === 'All' 
    ? apps 
    : apps.filter((app) => app.category === selectedCategory);

  const connectedCount = apps.filter((app) => app.connected).length;

  const handleConnect = (app: App) => {
    setSelectedApp(app);
    setShowConnectModal(true);
  };

  const handleConfirmConnect = () => {
    if (selectedApp) {
      setApps(
        apps.map((app) =>
          app.id === selectedApp.id ? { ...app, connected: true } : app
        )
      );
      setShowConnectModal(false);
      setSelectedApp(null);
    }
  };

  const handleDisconnect = (appId: string) => {
    const confirmed = window.confirm('Are you sure you want to disconnect this app?');
    if (confirmed) {
      setApps(
        apps.map((app) =>
          app.id === appId ? { ...app, connected: false } : app
        )
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-semibold text-neutral-900">App Connections</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Connect your favorite apps to enable powerful automations
        </p>
      </div>

      {/* Stats Bar */}
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 border border-primary-100 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-neutral-900">
              {connectedCount} <span className="text-lg font-normal text-neutral-600">/ {apps.length}</span>
            </div>
            <div className="text-sm text-neutral-600 mt-1">Apps Connected</div>
          </div>
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        <div className="mt-4 bg-white/60 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary-500 to-accent-500 h-full transition-all duration-500"
            style={{ width: `${(connectedCount / apps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Apps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApps.map((app) => {
          const IconComponent = app.icon;
          
          return (
            <div
              key={app.id}
              className={`
                bg-white border rounded-lg p-6 transition-all hover:shadow-md
                ${app.connected ? 'border-emerald-200 bg-emerald-50/20' : 'border-neutral-200'}
              `}
            >
              {/* App Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center
                    ${app.connected ? 'bg-emerald-100' : 'bg-neutral-100'}
                  `}>
                    <IconComponent className={`w-6 h-6 ${app.connected ? 'text-emerald-600' : 'text-neutral-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">{app.name}</h3>
                    <span className="text-xs text-neutral-500">{app.category}</span>
                  </div>
                </div>
                {app.connected && (
                  <span className="flex items-center space-x-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    <Check className="w-3 h-3" />
                    <span>Connected</span>
                  </span>
                )}
              </div>

              {/* App Description */}
              <p className="text-sm text-neutral-600 mb-4 leading-relaxed">{app.description}</p>

              {/* Action Buttons */}
              {app.connected ? (
                <div className="flex items-center space-x-2">
                  <button className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-neutral-50 text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors text-sm font-medium border border-neutral-200">
                    <Settings2 className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => handleDisconnect(app.id)}
                    className="flex items-center justify-center px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(app)}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  Connect {app.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredApps.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-full flex items-center justify-center mb-4">
            <Cloud className="w-8 h-8 text-neutral-400" />
          </div>
          <p className="text-neutral-600 font-medium">No apps found in this category</p>
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && selectedApp && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl animate-slide-down">
            <div className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-primary-100 rounded-full flex items-center justify-center mb-4">
                  {(() => {
                    const Icon = selectedApp.icon;
                    return <Icon className="w-8 h-8 text-primary-600" />;
                  })()}
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Connect {selectedApp.name}
                </h3>
                <p className="text-sm text-neutral-600 mb-6">
                  You'll be redirected to {selectedApp.name} to authorize access. 
                  UnifyOS will only access the data needed for automations.
                </p>

                {/* Permissions */}
                <div className="bg-neutral-50 rounded-lg p-4 mb-6 text-left">
                  <div className="text-sm font-semibold text-neutral-900 mb-3">
                    Permissions requested:
                  </div>
                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Read and write access</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Trigger events and notifications</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Access basic profile information</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowConnectModal(false);
                      setSelectedApp(null);
                    }}
                    className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmConnect}
                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                  >
                    Authorize & Connect
                  </button>
                </div>

                {/* Security Note */}
                <div className="mt-4 flex items-center justify-center space-x-1 text-xs text-neutral-500">
                  <span>🔒</span>
                  <span>Your credentials are encrypted and never stored</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
