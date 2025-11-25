'use client';

import { useState } from 'react';

interface App {
  id: string;
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  category: string;
}

const availableApps: App[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    description: 'Send and receive emails',
    connected: true,
    category: 'Communication',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Team messaging and collaboration',
    connected: true,
    category: 'Communication',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Manage events and schedules',
    connected: true,
    category: 'Productivity',
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">App Connections</h2>
        <p className="text-gray-600 mt-1">
          Connect your favorite apps to enable powerful automations
        </p>
      </div>

      {/* Stats Bar */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-gray-900">
              {connectedCount} <span className="text-lg text-gray-600">/ {apps.length}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">Apps Connected</div>
          </div>
          <div className="text-5xl">🔗</div>
        </div>
        <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all duration-500"
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
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Apps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className={`bg-white rounded-xl shadow-sm border-2 p-6 transition-all hover:shadow-md ${
              app.connected
                ? 'border-green-200 bg-green-50/30'
                : 'border-gray-200 hover:border-blue-200'
            }`}
          >
            {/* App Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-4xl">{app.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900">{app.name}</h3>
                  <span className="text-xs text-gray-500">{app.category}</span>
                </div>
              </div>
              {app.connected && (
                <span className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>Connected</span>
                </span>
              )}
            </div>

            {/* App Description */}
            <p className="text-sm text-gray-600 mb-4">{app.description}</p>

            {/* Action Button */}
            {app.connected ? (
              <div className="flex items-center space-x-2">
                <button className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">
                  Settings
                </button>
                <button
                  onClick={() => handleDisconnect(app.id)}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium text-sm"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect(app)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Connect {app.name}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredApps.length === 0 && (
        <div className="text-center py-12">
          <span className="text-6xl">🔍</span>
          <p className="text-gray-500 mt-4">No apps found in this category</p>
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center">
              <div className="text-6xl mb-4">{selectedApp.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Connect {selectedApp.name}
              </h3>
              <p className="text-gray-600 mb-6">
                You'll be redirected to {selectedApp.name} to authorize access. 
                UnifyOS will only access the data needed for automations.
              </p>

              {/* Permissions List */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <div className="text-sm font-semibold text-gray-900 mb-2">
                  Permissions requested:
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✓</span>
                    <span>Read and write access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✓</span>
                    <span>Trigger events and notifications</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✓</span>
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmConnect}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Authorize & Connect
                </button>
              </div>

              {/* Security Note */}
              <div className="mt-4 text-xs text-gray-500">
                🔒 Your credentials are encrypted and never stored
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }
