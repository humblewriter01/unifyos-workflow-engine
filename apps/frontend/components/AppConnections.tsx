'use client';

import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Calendar, FileText, Trello, CheckSquare, Target, Cloud, Check, X, Settings2, AlertCircle, Loader2 } from 'lucide-react';
import { api, App } from '../lib/api';

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

export default function AppConnections() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setLoading(true);
      const data = await api.apps.getAll();
      setApps(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load apps:', err);
      setError('Failed to load apps');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(apps.map((app) => app.category)))];
  
  const filteredApps = selectedCategory === 'All' 
    ? apps 
    : apps.filter((app) => app.category === selectedCategory);

  const connectedCount = apps.filter((app) => app.connected).length;

  const handleConnect = (app: App) => {
    setSelectedApp(app);
    setShowConnectModal(true);
  };

  const handleConfirmConnect = async () => {
    if (!selectedApp) return;
    
    try {
      await api.apps.connect(selectedApp.id);
      await loadApps();
      setShowConnectModal(false);
      setSelectedApp(null);
    } catch (err) {
      console.error('Failed to connect app:', err);
      alert('Failed to connect app. Please try again.');
    }
  };

  const handleDisconnect = async (appId: string) => {
    const confirmed = window.confirm('Are you sure you want to disconnect this app?');
    if (!confirmed) return;

    try {
      await api.apps.disconnect(appId);
      await loadApps();
    } catch (err) {
      console.error('Failed to disconnect app:', err);
      alert('Failed to disconnect app. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <div className="h-8 bg-neutral-200 dark:bg-dark-700 rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6 animate-pulse">
              <div className="h-12 w-12 bg-neutral-200 dark:bg-dark-600 rounded-lg mb-4"></div>
              <div className="h-4 bg-neutral-200 dark:bg-dark-600 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-neutral-200 dark:bg-dark-600 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">App Connections</h1>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
              <button
                onClick={loadApps}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">App Connections</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Connect your favorite apps to enable powerful automations
        </p>
      </div>

      {/* Stats Bar */}
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 border border-primary-100 dark:border-primary-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-white">
              {connectedCount} <span className="text-lg font-normal text-neutral-600 dark:text-neutral-400">/ {apps.length}</span>
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Apps Connected</div>
          </div>
          <div className="w-16 h-16 bg-white dark:bg-dark-800 rounded-full flex items-center justify-center shadow-sm">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        <div className="mt-4 bg-white/60 dark:bg-dark-800/60 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary-500 to-accent-500 h-full transition-all duration-500"
            style={{ width: `${apps.length > 0 ? (connectedCount / apps.length) * 100 : 0}%` }}
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
                : 'bg-white dark:bg-dark-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-dark-700 border border-neutral-200 dark:border-dark-600'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Apps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApps.map((app) => {
          const IconComponent = iconMap[app.id] || Cloud;
          
          return (
            <div
              key={app.id}
              className={`
                bg-white dark:bg-dark-800 border rounded-lg p-6 transition-all hover:shadow-md dark:hover:shadow-dark-900/50
                ${app.connected ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-900/10' : 'border-neutral-200 dark:border-dark-700'}
              `}
            >
              {/* App Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center
                    ${app.connected ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-neutral-100 dark:bg-dark-700'}
                  `}>
                    <IconComponent className={`w-6 h-6 ${app.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-white">{app.name}</h3>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{app.category}</span>
                  </div>
                </div>
                {app.connected && (
                  <span className="flex items-center space-x-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                    <Check className="w-3 h-3" />
                    <span>Connected</span>
                  </span>
                )}
              </div>

              {/* App Description */}
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 leading-relaxed">{app.description}</p>

              {/* Action Buttons */}
              {app.connected ? (
                <div className="flex items-center space-x-2">
                  <button className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-neutral-50 dark:bg-dark-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-600 transition-colors text-sm font-medium border border-neutral-200 dark:border-dark-600">
                    <Settings2 className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => handleDisconnect(app.id)}
                    className="flex items-center justify-center px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(app)}
                  className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg transition-colors text-sm font-medium"
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
          <div className="w-16 h-16 mx-auto bg-neutral-100 dark:bg-dark-700 rounded-full flex items-center justify-center mb-4">
            <Cloud className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">No apps found in this category</p>
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && selectedApp && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full shadow-2xl animate-slide-down">
            <div className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
                  {(() => {
                    const Icon = iconMap[selectedApp.id] || Cloud;
                    return <Icon className="w-8 h-8 text-primary-600 dark:text-primary-400" />;
                  })()}
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  Connect {selectedApp.name}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                  You'll be redirected to {selectedApp.name} to authorize access. 
                  UnifyOS will only access the data needed for automations.
                </p>

                {/* Permissions */}
                <div className="bg-neutral-50 dark:bg-dark-700 rounded-lg p-4 mb-6 text-left">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
                    Permissions requested:
                  </div>
                  <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>Read and write access</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>Trigger events and notifications</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
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
                    className="flex-1 px-4 py-2.5 border border-neutral-200 dark:border-dark-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-dark-700 transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmConnect}
                    className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    Authorize & Connect
                  </button>
                </div>

                {/* Security Note */}
                <div className="mt-4 flex items-center justify-center space-x-1 text-xs text-neutral-500 dark:text-neutral-400">
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

// Location: apps/frontend/components/AppConnections.tsx
