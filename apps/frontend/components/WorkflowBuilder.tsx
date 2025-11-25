'use client';

import { useState } from 'react';

interface Trigger {
  id: string;
  app: string;
  event: string;
  icon: string;
}

interface Action {
  id: string;
  app: string;
  task: string;
  icon: string;
}

interface Workflow {
  trigger: Trigger | null;
  actions: Action[];
}

const availableTriggers: Trigger[] = [
  { id: 't1', app: 'Gmail', event: 'New email received', icon: '📧' },
  { id: 't2', app: 'Slack', event: 'Message in channel', icon: '💬' },
  { id: 't3', app: 'Calendar', event: 'Event starting soon', icon: '📅' },
  { id: 't4', app: 'Notion', event: 'Database updated', icon: '📝' },
];

const availableActions: Action[] = [
  { id: 'a1', app: 'Slack', task: 'Send message', icon: '💬' },
  { id: 'a2', app: 'Gmail', task: 'Send email', icon: '📧' },
  { id: 'a3', app: 'Notion', task: 'Create page', icon: '📝' },
  { id: 'a4', app: 'Calendar', task: 'Create event', icon: '📅' },
  { id: 'a5', app: 'Trello', task: 'Create card', icon: '📋' },
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
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    alert('Workflow saved successfully!');
  };

  const handleTestWorkflow = async () => {
    if (!workflow.trigger || workflow.actions.length === 0) {
      alert('Please add at least one trigger and one action');
      return;
    }
    
    alert('Testing workflow... (This would trigger the workflow in production)');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Builder</h2>
          <p className="text-gray-600 mt-1">Create automated workflows between your apps</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestWorkflow}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Test Workflow
          </button>
          <button
            onClick={handleSaveWorkflow}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="space-y-8">
          {/* Trigger Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg font-semibold text-gray-900">When this happens...</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                TRIGGER
              </span>
            </div>

            {workflow.trigger ? (
              <div className="relative">
                <div className="flex items-center justify-between p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{workflow.trigger.icon}</span>
                    <div>
                      <div className="font-semibold text-gray-900">{workflow.trigger.app}</div>
                      <div className="text-sm text-gray-600">{workflow.trigger.event}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setWorkflow({ ...workflow, trigger: null })}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                {/* Connector Line */}
                <div className="flex justify-center my-4">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-purple-300 to-blue-300"></div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowTriggerMenu(!showTriggerMenu)}
                  className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-gray-500 hover:text-purple-600 font-medium"
                >
                  + Add Trigger
                </button>

                {/* Trigger Dropdown */}
                {showTriggerMenu && (
                  <div className="absolute z-10 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-auto">
                    {availableTriggers.map((trigger) => (
                      <button
                        key={trigger.id}
                        onClick={() => handleSelectTrigger(trigger)}
                        className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-2xl">{trigger.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900">{trigger.app}</div>
                          <div className="text-sm text-gray-600">{trigger.event}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions Section */}
          {workflow.trigger && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-lg font-semibold text-gray-900">Then do this...</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  ACTIONS
                </span>
              </div>

              <div className="space-y-4">
                {workflow.actions.map((action, index) => (
                  <div key={action.id}>
                    <div className="flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
                          {index + 1}
                        </div>
                        <span className="text-2xl">{action.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900">{action.app}</div>
                          <div className="text-sm text-gray-600">{action.task}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAction(action.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Connector Line between actions */}
                    {index < workflow.actions.length - 1 && (
                      <div className="flex justify-center my-2">
                        <div className="w-0.5 h-6 bg-blue-200"></div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Action Button */}
                <div className="relative">
                  {workflow.actions.length > 0 && (
                    <div className="flex justify-center mb-4">
                      <div className="w-0.5 h-6 bg-blue-200"></div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowActionMenu(!showActionMenu)}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-500 hover:text-blue-600 font-medium"
                  >
                    + Add Another Action
                  </button>

                  {/* Action Dropdown */}
                  {showActionMenu && (
                    <div className="absolute z-10 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-auto">
                      {availableActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleAddAction(action)}
                          className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className="text-2xl">{action.icon}</span>
                          <div>
                            <div className="font-medium text-gray-900">{action.app}</div>
                            <div className="text-sm text-gray-600">{action.task}</div>
                          </div>
                        </button>
                      ))}
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
            <span className="text-6xl">⚡</span>
            <p className="text-gray-500 mt-4">
              Start by adding a trigger to begin building your workflow
            </p>
          </div>
        )}
      </div>

      {/* Example Workflows */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-semibold text-gray-900 mb-3">💡 Popular Workflow Ideas</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div>• When I receive an email → Create a Slack notification</div>
          <div>• When a Calendar event starts → Send reminder to team</div>
          <div>• When Notion page is updated → Post update in Slack</div>
        </div>
      </div>
    </div>
  );
  }
