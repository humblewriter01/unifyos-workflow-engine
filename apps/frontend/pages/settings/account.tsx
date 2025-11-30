// apps/frontend/pages/settings/account.tsx
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Trash2, Download, AlertTriangle, Shield, CheckCircle, Loader2 } from 'lucide-react';

export default function AccountSettings() {
  const { data: session } = useSession();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const response = await fetch('/api/user/export', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unifyos-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Deletion failed');

      await signOut({ callbackUrl: '/auth/deleted' });
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Account Settings</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Manage your account data and preferences
          </p>
        </div>

        {/* Data Export (GDPR) */}
        <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                Export Your Data
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Download a copy of all your data in JSON format. This includes your profile, workflows, notifications, and connected apps.
              </p>
              <button
                onClick={handleExportData}
                disabled={exportLoading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {exportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Privacy & GDPR */}
        <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                Privacy & Data Rights
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Your privacy matters. Learn about how we handle your data and your rights under GDPR.
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Right to access your personal data
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Right to rectification and portability
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Right to erasure (account deletion)
                  </span>
                </div>
              </div>
              <a
                href="/privacy"
                className="inline-block mt-4 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                Read our Privacy Policy →
              </a>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-dark-800 border-2 border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-1">
                Danger Zone
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete My Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 dark:border-dark-700">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-white text-center mb-2">
                Delete Account
              </h3>
              
              <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center mb-6">
                This action is permanent and cannot be undone. All of your data will be permanently deleted:
              </p>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-300">
                  <li>• Your profile and account information</li>
                  <li>• All workflows and automations</li>
                  <li>• Connected app integrations</li>
                  <li>• Notification history</li>
                  <li>• All associated data</li>
                </ul>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-neutral-900 dark:text-white"
                  placeholder="Type DELETE"
                />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-neutral-100 dark:bg-dark-700 hover:bg-neutral-200 dark:hover:bg-dark-600 border border-neutral-200 dark:border-dark-600 rounded-lg text-neutral-700 dark:text-neutral-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmation !== 'DELETE' || loading}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Forever</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
