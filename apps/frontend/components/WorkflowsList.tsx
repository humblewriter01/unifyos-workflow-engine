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
          <div key={i} className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-neutral-100 rounded w-1/3"></div>
              <div className="h-4 bg-neutral-100 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              onClick={loadWorkflows}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
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
      <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
        <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-full flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-neutral-400" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          No workflows yet
        </h3>
        <p className="text-sm text-neutral-600 mb-6">
          Create your first workflow to automate tasks between apps
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">
            Your Workflows ({workflows.length})
          </h3>
          <p className="text-sm text-neutral-600 mt-1">
            {workflows.filter((w) => w.active).length} active
          </p>
        </div>
        <button
          onClick={loadWorkflows}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Workflows List */}
      {workflows.map((workflow) => (
        <div
          key={workflow.id}
          className="bg-white border border-neutral-200 rounded-lg p-6 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-3">
                <h3 className="text-base font-semibold text-neutral-900 truncate">
                  {workflow.name}
                </h3>
                {workflow.active ? (
                  <span className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full flex-shrink-0">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-full flex-shrink-0">
                    Paused
                  </span>
                )}
              </div>

              {/* Workflow Flow */}
              <div className="flex items-center space-x-2 text-sm mb-3 overflow-x-auto">
                <div className="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg whitespace-nowrap flex-shrink-0">
                  <span className="font-medium text-purple-700">{workflow.trigger.app}</span>
                  <span className="text-purple-600 mx-1">:</span>
                  <span className="text-neutral-600">{workflow.trigger.event}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                {workflow.actions.map((action, idx) => (
                  <div key={idx} className="flex items-center space-x-2 flex-shrink-0">
                    <div className="px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg whitespace-nowrap">
                      <span className="font-medium text-primary-700">{action.app}</span>
                      <span className="text-primary-600 mx-1">:</span>
                      <span className="text-neutral-600">{action.task}</span>
                    </div>
                    {idx < workflow.actions.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-4 text-xs text-neutral-500">
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
                className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                title={workflow.active ? 'Pause workflow' : 'Activate workflow'}
              >
                {workflow.active ? (
                  <Pause className="w-4 h-4 text-neutral-600" />
                ) : (
                  <Play className="w-4 h-4 text-neutral-600" />
                )}
              </button>
              <button
                onClick={() => handleTest(workflow.id)}
                className="px-3 py-2 border border-neutral-200 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors"
              >
                Test
              </button>
              <button
                onClick={() => handleDelete(workflow.id)}
                className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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
