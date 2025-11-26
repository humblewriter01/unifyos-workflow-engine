import { useState } from 'react';
import { List, Plus } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import WorkflowBuilder from '../components/WorkflowBuilder';
import WorkflowsList from '../components/WorkflowsList';

export default function WorkflowsPage() {
  const [view, setView] = useState<'list' | 'builder'>('list');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-200 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">Workflows</h1>
              <p className="text-sm text-neutral-600 mt-1">
                Automate tasks between your connected apps
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setView('list')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'list'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
                }`}
              >
                <List className="w-4 h-4" />
                <span>My Workflows</span>
              </button>
              <button
                onClick={() => setView('builder')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'builder'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Create New</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {view === 'list' ? <WorkflowsList /> : <WorkflowBuilder />}
      </div>
    </DashboardLayout>
  );
}
