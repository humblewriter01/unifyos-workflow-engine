import { useEffect, useState } from 'react';
import { Link2, Zap, Clock, TrendingUp, Activity } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import UnifiedInbox from '../components/UnifiedInbox';
import { api, AnalyticsData } from '../lib/api';

export default function Home() {
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.analytics.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="border-b border-neutral-200 pb-5">
          <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Monitor your workflow automation and app integrations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-5 h-5 text-red-600">⚠</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Connected Apps */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-600">Connected Apps</p>
                {loading ? (
                  <div className="mt-2 h-8 bg-neutral-100 rounded animate-pulse"></div>
                ) : (
                  <div className="mt-2 flex items-baseline space-x-2">
                    <p className="text-2xl font-semibold text-neutral-900">
                      {stats?.connectedApps || 0}
                    </p>
                    <p className="text-sm text-neutral-500">
                      / {stats?.totalApps || 8}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-emerald-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              <span>2 new this week</span>
            </div>
          </div>

          {/* Active Workflows */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-600">Active Workflows</p>
                {loading ? (
                  <div className="mt-2 h-8 bg-neutral-100 rounded animate-pulse"></div>
                ) : (
                  <div className="mt-2">
                    <p className="text-2xl font-semibold text-neutral-900">
                      {stats?.activeWorkflows || 0}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-accent-600" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-neutral-500">
                {stats?.workflowExecutions || 0} total executions
              </p>
            </div>
          </div>

          {/* Time Saved */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-600">Time Saved</p>
                {loading ? (
                  <div className="mt-2 h-8 bg-neutral-100 rounded animate-pulse"></div>
                ) : (
                  <div className="mt-2">
                    <p className="text-2xl font-semibold text-neutral-900">
                      {stats?.timeSaved || 0}h
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-neutral-500">This week</p>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-600">Notifications</p>
                {loading ? (
                  <div className="mt-2 h-8 bg-neutral-100 rounded animate-pulse"></div>
                ) : (
                  <div className="mt-2">
                    <p className="text-2xl font-semibold text-neutral-900">
                      {stats?.notificationsProcessed || 0}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-neutral-500">Processed this week</p>
            </div>
          </div>
        </div>

        {/* Unified Inbox */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="px-6 py-4 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">
                Recent Activity
              </h2>
              <button
                onClick={loadStats}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="p-6">
            <UnifiedInbox />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
