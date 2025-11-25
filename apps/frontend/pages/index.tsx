import DashboardLayout from '../components/layout/DashboardLayout';
import UnifiedInbox from '../components/UnifiedInbox';

export default function Home() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">
            Welcome to Your Command Center
          </h1>
          <p className="text-blue-100">
            All your apps, notifications, and workflows in one place
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Connected Apps</h3>
              <span className="text-2xl">🔗</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">3</p>
            <p className="text-sm text-gray-500 mt-1">of 8 possible</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Active Workflows</h3>
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">2</p>
            <p className="text-sm text-gray-500 mt-1">automations running</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Time Saved</h3>
              <span className="text-2xl">⏱️</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">4.5h</p>
            <p className="text-sm text-gray-500 mt-1">this week</p>
          </div>
        </div>

        {/* Unified Inbox Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Unified Inbox
            </h2>
            <UnifiedInbox />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
