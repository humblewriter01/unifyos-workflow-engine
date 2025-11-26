import type { NextApiRequest, NextApiResponse } from 'next';

interface Workflow {
  id: string;
  name: string;
  trigger: {
    app: string;
    event: string;
  };
  actions: Array<{
    app: string;
    task: string;
  }>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  executions: number;
}

// In-memory storage (replace with database in production)
let workflows: Workflow[] = [
  {
    id: '1',
    name: 'Email to Slack Notification',
    trigger: { app: 'Gmail', event: 'New email received' },
    actions: [
      { app: 'Slack', task: 'Send message to #notifications' },
    ],
    active: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    executions: 47,
  },
  {
    id: '2',
    name: 'Calendar Reminder System',
    trigger: { app: 'Calendar', event: 'Event starting in 15 minutes' },
    actions: [
      { app: 'Slack', task: 'Send reminder' },
      { app: 'Gmail', task: 'Send email reminder' },
    ],
    active: true,
    createdAt: '2024-01-20T14:30:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    executions: 23,
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      // Get all workflows
      const activeCount = workflows.filter(w => w.active).length;
      return res.status(200).json({
        success: true,
        data: workflows,
        meta: {
          total: workflows.length,
          active: activeCount,
          totalExecutions: workflows.reduce((sum, w) => sum + w.executions, 0),
        },
      });

    case 'POST':
      // Create new workflow
      const { name, trigger, actions } = req.body;

      if (!name || !trigger || !actions || actions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, trigger, actions',
        });
      }

      const newWorkflow: Workflow = {
        id: Date.now().toString(),
        name,
        trigger,
        actions,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executions: 0,
      };

      workflows.push(newWorkflow);

      return res.status(201).json({
        success: true,
        data: newWorkflow,
        message: 'Workflow created successfully',
      });

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`,
      });
  }
}
