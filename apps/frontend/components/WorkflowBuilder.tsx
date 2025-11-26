'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Calendar, FileText, Trello, Play, Save, Plus, X, ArrowRight, Zap } from 'lucide-react';

interface Trigger {
  id: string;
  app: string;
  event: string;
  icon: any;
}

interface Action {
  id: string;
  app: string;
  task: string;
  icon: any;
}

interface Workflow {
  trigger: Trigger | null;
  actions: Action[];
}

const iconMap: Record<string, any> = {
  Gmail: Mail,
  Slack: MessageSquare,
  Calendar: Calendar,
  Notion: FileText,
  Trello: Trello,
};

const availableTriggers: Trigger[] = [
  { id: 't1', app: 'Gmail', event: 'New email received', icon: Mail },
  { id: 't2', app: 'Slack', event: 'Message in channel', icon: MessageSquare },
  { id: 't3', app: 'Calendar', event: 'Event starting soon', icon: Calendar },
  { id: 't4', app: 'Notion', event: 'Database updated', icon: FileText },
];

const availableActions: Action[] = [
  { id: 'a1', app: 'Slack', task: 'Send message', icon: MessageSquare },
  { id: 'a2', app: 'Gmail', task: 'Send email', icon: Mail },
  { id: 'a3', app: 'Notion', task: 'Create page', icon: FileText },
  { id: 'a4', app: 'Calendar', task: 'Create event', icon: Calendar },
  { id: 'a5', app: 'Trello', task: 'Create card', icon: Trello },
];

export default function WorkflowBuilder() {
  const [workflow, setWorkflow] = useState<Workflow>({
    trigger: null,
    actions: [],
  });
  const [showTriggerMenu, setShowTriggerMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectTrigger = (trigger: Trigger) => {
    setWorkflow({ ...workflow, trigger });
    setShowTriggerMenu(false);
  };

  const handleAddAction = (action: Action) => {
    setWorkflow({
      ...workflow,
      actions: [...workflow.actions, { ...action, id: `${action.id}-${Date.now()}` }],
    });
    setShowActionMenu(false);
  };

  const handleRemoveAction = (actionId: string) => {
    setWorkflow({
      ...workflow,
      actions: workflow.actions.filter((a) => a.id !== actionId),
    });
  };

  const handleSaveWorkflow = async () => {
    if (!workflow.trigger || workflow.actions.length === 0) {
      alert('Please add at least one trigger and one action');
      return;
    }
    
    setIsSaving(true);
    try {
      const { api } = await import('../lib/api');
      
      const workflowData = {
        name: `${workflow.trigger.app} → ${workflow.actions.map(a => a.app).join(' → ')}`,
        trigger: {
          app: workflow.trigger.app,
          event: workflow.trigger.event,
        },
        actions: workflow.actions.map(action => ({
          app: action.app,
          task: action.task,
        })),
      };
      
      await api.workflows.create(workflowData);
      alert('Workflow saved successfully!');
      setWorkflow({ trigger: null, actions: [] });
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWorkflow = async () => {
    if (!workflow.trigger || workflow.actions.length === 0) {
      alert('Please add at least one trigger and one action');
      return;
    }
    
    alert('Testing workflow... Check console for details');
    console.log('Workflow test:', {
      trigger: workflow.trigger,
      actions: workflow.actions,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Workflow Builder</h2>
          <p className="text-sm text-neutral-600 mt-1">Create automated workflows between your apps</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestWorkflow}
            className="flex items-center space-x-2 px-4 py-2 border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            <span>Test</span>
          </button>
          <button
            onClick={handleSaveWorkflow}
            disabled={isSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Workflow'}</span>
          </button>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="bg-white border border-neutral-200 rounded-lg p-8">
        <div className="space-y-6">
          {/* Trigger Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-sm font-semibold text-neutral-900">When this happens</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                TRIGGER
              </span>
            </div>

            {workflow.trigger ? (
              <div className="relative">
                <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const Icon = workflow.trigger.icon;
                      return (
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-purple-600" />
                        </div>
                      );
                    })()}
                    <div>
                      <div className="font-semibold text-neutral-900">{workflow.trigger.app}</div>
                      <div className="text-sm text-neutral-600">{workflow.trigger.event}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setWorkflow({ ...workflow, trigger: null })}
                    className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Connector Arrow */}
                <div className="flex justify-center my-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-0.5 h-6 bg-neutral-300"></div>
                    <ArrowRight className="w-4 h-4 text-neutral-400" />
                    <div className="w-0.5 h-6 bg-neutral-300"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowTriggerMenu(!showTriggerMenu)}
                  className="w-full p-6 border-2 border-dashed border-neutral-300 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 transition-all text-neutral-500 hover:text-purple-600 text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Trigger</span>
                </button>

                {/* Trigger Dropdown */}
                {showTriggerMenu && (
                  <div className="absolute z-10 mt-2 w-full bg-white rounded-lg shadow-lg border border-neutral-200 max-h-64 overflow-auto">
                    {availableTriggers.map((trigger) => {
                      const Icon = trigger.icon;
                      return (
                        <button
                          key={trigger.id}
                          onClick={() => handleSelectTrigger(trigger)}
                          className="w-full flex items-center space-x-3 p-3 hover:bg-neutral-50 transition-colors text-left"
                        >
                          <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-neutral-600" />
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900">{trigger.app}</div>
                            <div className="text-sm text-neutral-600">{trigger.event}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions Section */}
          {workflow.trigger && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-sm font-semibold text-neutral-900">Then do this</span>
                <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                  ACTIONS
                </span>
              </div>

              <div className="space-y-3">
                {workflow.actions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <div key={action.id}>
                      <div className="flex items-center justify-between p-4 bg-primary-50 border border-primary-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-6 h-6 bg-primary-600 text-white text-xs font-bold rounded-full">
                            {index + 1}
                          </div>
                          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900">{action.app}</div>
                            <div className="text-sm text-neutral-600">{action.task}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAction(action.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Connector between actions */}
                      {index < workflow.actions.length - 1 && (
                        <div className="flex justify-center my-2">
                          <ArrowRight className="w-4 h-4 text-neutral-400" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Action Button */}
                <div className="relative">
                  {workflow.actions.length > 0 && (
                    <div className="flex justify-center mb-3">
                      <ArrowRight className="w-4 h-4 text-neutral-400" />
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowActionMenu(!showActionMenu)}
                    className="w-full p-4 border-2 border-dashed border-neutral-300 rounded-lg hover:border-primary-400 hover:bg-primary-50/50 transition-all text-neutral-500 hover:text-primary-600 text-sm font-medium flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Action</span>
                  </button>

                  {/* Action Dropdown */}
                  {showActionMenu && (
                    <div className="absolute z-10 mt-2 w-full bg-white rounded-lg shadow-lg border border-neutral-200 max-h-64 overflow-auto">
                      {availableActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            onClick={() => handleAddAction(action)}
                            className="w-full flex items-center space-x-3 p-3 hover:bg-neutral-50 transition-colors text-left"
                          >
                            <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                              <Icon className="w-5 h-5 text-neutral-600" />
                            </div>
                            <div>
                              <div className="font-medium text-neutral-900">{action.app}</div>
                              <div className="text-sm text-neutral-600">{action.task}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {!workflow.trigger && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-600 font-medium mb-1">Start building your workflow</p>
            <p className="text-sm text-neutral-500">
              Add a trigger to begin automating tasks
            </p>
          </div>
        )}
      </div>

      {/* Example Workflows */}
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 border border-primary-100 rounded-lg p-6">
        <h3 className="font-semibold text-neutral-900 mb-3 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-primary-600" />
          <span>Popular Workflow Ideas</span>
        </h3>
        <div className="space-y-2 text-sm text-neutral-700">
          <div className="flex items-center space-x-2">
            <ArrowRight className="w-4 h-4 text-neutral-400" />
            <span>When I receive an email → Create a Slack notification</span>
          </div>
          <div className="flex items-center space-x-2">
            <ArrowRight className="w-4 h-4 text-neutral-400" />
            <span>When a Calendar event starts → Send reminder to team</span>
          </div>
          <div className="flex items-center space-x-2">
            <ArrowRight className="w-4 h-4 text-neutral-400" />
            <span>When Notion page is updated → Post update in Slack</span>
          </div>
        </div>
      </div>
    </div>
  );
}
