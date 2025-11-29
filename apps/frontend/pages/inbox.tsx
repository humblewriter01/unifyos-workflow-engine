import DashboardLayout from '../components/layout/DashboardLayout';
import UnifiedInbox from '../components/UnifiedInbox';

export default function InboxPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Unified Inbox</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            All your notifications in one place
          </p>
        </div>

        {/* Inbox Content */}
        <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
          <UnifiedInbox />
        </div>
      </div>
    </DashboardLayout>
  );
}

// Location: apps/frontend/pages/inbox.tsx
