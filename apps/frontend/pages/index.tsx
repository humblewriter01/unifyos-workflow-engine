import { useEffect, useState } from 'react';
import { Link2, Zap, Clock, TrendingUp, Activity, AlertCircle, ArrowRight } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { api, AnalyticsData, Notification } from '../lib/api';

export default function Home() {
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, notificationsData] = await Promise.all([
        api.analytics.getStats(),
        api.notifications.getAll()
      ]);
      setStats(statsData);
      setNotifications(notificationsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, suffix, trend, loading }: any) => (
    <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-5 hover:shadow-md dark:hover:shadow-dark-900/50 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 bg-neutral-100 dark:bg-dark-700 rounded animate-pulse"></div>
          ) : (
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {value}
              </p>
              {suffix && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {suffix}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="w-3 h-3 mr-1" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/20 dark:to-accent-900/20 rounded-full flex items-center justify-center mb-6">
        <Zap className="w-10 h-10 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
        Welcome to UnifyOS
      </h3>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
        Connect your first app to start automating your workflow and centralizing your notifications
      </p>
      <button className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors font-medium inline-flex items-center space-x-2">
        <Link2 className="w-4 h-4" />
        <span>Connect Your First App</span>
      </button>
      
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto text-left">
        <div className="p-4 bg-neutral-50 dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-700">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center mb-3">
            <Link2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">Connect Apps</h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Link Slack, Gmail, Calendar and more</p>
        </div>
        <div className="p-4 bg-neutral-50 dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-700">
          <div className="w-10 h-10 bg-accent-100 dark:bg-accent-900/20 rounded-lg flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-accent-600 dark:text-accent-400" />
          </div>
          <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">Build Workflows</h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Automate tasks between your apps</p>
        </div>
        <div className="p-4 bg-neutral-50 dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-700">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">Save Time</h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Let automation handle repetitive work</p>
        </div>
      </div>
    </div>
  );

  const NotificationsEmpty = () => (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">📭</div>
      <h4 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
        No notifications yet
      </h4>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Notifications from your connected apps will appear here
      </p>
    </div>
  );

  const hasData = stats && (stats.connectedApps > 0 || stats.activeWorkflows > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Monitor your workflow automation and app integrations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
                <button
                  onClick={loadDashboardData}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid - Only show if user has data */}
        {hasData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Link2}
              label="Connected Apps"
              value={stats.connectedApps}
              suffix={`/ ${stats.totalApps}`}
              loading={loading}
            />
            <StatCard
              icon={Zap}
              label="Active Workflows"
              value={stats.activeWorkflows}
              loading={loading}
            />
            <StatCard
              icon={Clock}
              label="Time Saved"
              value={`${stats.timeSaved}h`}
              loading={loading}
            />
            <StatCard
              icon={Activity}
              label="Notifications"
              value={stats.notificationsProcessed}
              loading={loading}
            />
          </div>
        )}

        {/* Empty State - Show when no data */}
        {!loading && !hasData && <EmptyState />}

        {/* Notifications Section - Only show if user has apps connected */}
        {hasData && (
          <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Recent Activity
                </h2>
                <button
                  onClick={loadDashboardData}
                  className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="p-6">
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start space-x-4 p-4 rounded-lg border transition-all ${
                        notification.unread
                          ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800'
                          : 'bg-neutral-50 dark:bg-dark-700 border-neutral-200 dark:border-dark-600'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full mt-2 ${
                        notification.unread 
                          ? 'bg-primary-500' 
                          : 'bg-neutral-400 dark:bg-neutral-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-neutral-900 dark:text-white">{notification.app}</span>
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">{notification.time}</span>
                        </div>
                        <p className="text-neutral-700 dark:text-neutral-300 text-sm">{notification.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <NotificationsEmpty />
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Location: apps/frontend/pages/index.tsx
