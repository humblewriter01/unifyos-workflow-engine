'use client';

import { useEffect, useState } from 'react';
import { Play, Pause, Trash2, ArrowRight, Clock, Zap, AlertCircle } from 'lucide-react';
import { api, Workflow } from '../lib/api';

export default function WorkflowsList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await api.workflows.getAll();
      setWorkflows(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load workflows:', err);
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      await api.workflows.update(workflow.id, { active: !workflow.active });
      setWorkflows(
        workflows.map((w) =>
          w.id === workflow.id ? { ...w, active: !w.active } : w
        )
      );
    } catch (err) {
      alert('Failed to update workflow');
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await api.workflows.delete(workflowId);
      setWorkflows(workflows.filter((w) => w.id !== workflowId));
    } catch (err) {
      alert('Failed to delete workflow');
    }
  };

  const handleTest = async (workflowId: string) => {
    try {
      const result = await api.workflows.test(workflowId);
      alert(result.message);
    } catch (err) {
      alert('Failed to test workflow');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-neutral-100 dark:bg-dark-700 rounded w-1/3"></div>
              <div className="h-4 bg-neutral-100 dark:bg-dark-700 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
            <button
              onClick={loadWorkflows}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-12 text-center">
        <div className="w-16 h-16 mx-auto bg-neutral-100 dark:bg-dark-700 rounded-full flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          No workflows yet
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Create your first workflow to automate tasks between apps
        </p>
        <button className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg transition-colors font-medium">
          Create Workflow
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
            Your Workflows ({workflows.length})
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {workflows.filter((w) => w.active).length} active
          </p>
        </div>
        <button
          onClick={loadWorkflows}
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Workflows List */}
      {workflows.map((workflow) => (
        <div
          key={workflow.id}
          className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6 hover:shadow-md dark:hover:shadow-dark-900/50 transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-3">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white truncate">
                  {workflow.name}
                </h3>
                {workflow.active ? (
                  <span className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full flex-shrink-0">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-neutral-100 dark:bg-dark-700 text-neutral-600 dark:text-neutral-400 text-xs font-medium rounded-full flex-shrink-0">
                    Paused
                  </span>
                )}
              </div>

              {/* Workflow Flow */}
              <div className="flex items-center space-x-2 text-sm mb-3 overflow-x-auto">
                <div className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg whitespace-nowrap flex-shrink-0">
                  <span className="font-medium text-purple-700 dark:text-purple-400">{workflow.trigger.app}</span>
                  <span className="text-purple-600 dark:text-purple-500 mx-1">:</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{workflow.trigger.event}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                {workflow.actions.map((action, idx) => (
                  <div key={idx} className="flex items-center space-x-2 flex-shrink-0">
                    <div className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg whitespace-nowrap">
                      <span className="font-medium text-primary-700 dark:text-primary-400">{action.app}</span>
                      <span className="text-primary-600 dark:text-primary-500 mx-1">:</span>
                      <span className="text-neutral-600 dark:text-neutral-400">{action.task}</span>
                    </div>
                    {idx < workflow.actions.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-4 text-xs text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Created {new Date(workflow.createdAt).toLocaleDateString()}</span>
                </div>
                {workflow.executions !== undefined && (
                  <div className="flex items-center space-x-1">
                    <Zap className="w-3 h-3" />
                    <span>{workflow.executions} executions</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={() => handleToggleActive(workflow)}
                className="p-2 border border-neutral-200 dark:border-dark-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 transition-colors"
                title={workflow.active ? 'Pause workflow' : 'Activate workflow'}
              >
                {workflow.active ? (
                  <Pause className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                ) : (
                  <Play className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                )}
              </button>
              <button
                onClick={() => handleTest(workflow.id)}
                className="px-3 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-dark-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                Test
              </button>
              <button
                onClick={() => handleDelete(workflow.id)}
                className="p-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete workflow"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Location: apps/frontend/components/WorkflowsList.tsx
