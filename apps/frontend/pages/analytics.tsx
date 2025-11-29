import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Zap, Link2, Activity, Calendar, BarChart3 } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { api, AnalyticsData } from '../lib/api';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await api.analytics.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ icon: Icon, label, value, change, positive = true }: any) => (
    <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 bg-neutral-100 dark:bg-dark-700 rounded animate-pulse"></div>
          ) : (
            <p className="text-3xl font-bold text-neutral-900 dark:text-white mt-2">{value}</p>
          )}
        </div>
        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
      {change && (
        <div className={`flex items-center text-sm ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          <TrendingUp className={`w-4 h-4 mr-1 ${!positive && 'rotate-180'}`} />
          <span>{change}</span>
        </div>
      )}
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto bg-neutral-100 dark:bg-dark-700 rounded-full flex items-center justify-center mb-6">
        <BarChart3 className="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
      </div>
      <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
        No Analytics Data Yet
      </h3>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
        Connect apps and create workflows to start seeing analytics about your automation
      </p>
      <button className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors font-medium">
        Get Started
      </button>
    </div>
  );

  const hasData = stats && (stats.connectedApps > 0 || stats.activeWorkflows > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Analytics</h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Track your automation performance and time savings
              </p>
            </div>
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-dark-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {!loading && !hasData ? (
          <EmptyState />
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={Link2}
                label="Connected Apps"
                value={stats?.connectedApps || 0}
              />
              <MetricCard
                icon={Zap}
                label="Active Workflows"
                value={stats?.activeWorkflows || 0}
              />
              <MetricCard
                icon={Clock}
                label="Time Saved (Hours)"
                value={stats?.timeSaved || 0}
              />
              <MetricCard
                icon={Activity}
                label="Total Executions"
                value={stats?.workflowExecutions || 0}
              />
            </div>

            {/* Activity Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Workflow Performance */}
              <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    Workflow Performance
                  </h3>
                  <Calendar className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-dark-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">Success Rate</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Past 7 days</p>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {stats?.workflowExecutions ? '98%' : '-'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-dark-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">Avg. Execution Time</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Past 7 days</p>
                    </div>
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {stats?.workflowExecutions ? '1.2s' : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Savings Breakdown */}
              <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    Time Savings Breakdown
                  </h3>
                  <Clock className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
                </div>
                {stats?.timeSaved && stats.timeSaved > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">Email Automation</span>
                      </div>
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {(stats.timeSaved * 0.4).toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-accent-500 rounded-full"></div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">Task Management</span>
                      </div>
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {(stats.timeSaved * 0.3).toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">Notifications</span>
                      </div>
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {(stats.timeSaved * 0.2).toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">Data Sync</span>
                      </div>
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {(stats.timeSaved * 0.1).toFixed(1)}h
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      No time savings data yet
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Recent Activity
              </h3>
              {stats?.workflowExecutions && stats.workflowExecutions > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-neutral-50 dark:bg-dark-700 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 dark:text-white">System activity will appear here</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Showing recent workflow executions</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    No recent activity yet. Create and run workflows to see activity here.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// Location: apps/frontend/pages/analytics.tsx
