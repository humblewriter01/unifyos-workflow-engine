import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';

const emptyMeta = { total: 0, active: 0, totalExecutions: 0 };

function toWorkflowResponse(workflow: any) {
  const actions = Array.isArray(workflow.actions) ? workflow.actions : [];
  return {
    id: workflow.id,
    name: workflow.name,
    trigger: { app: workflow.triggerApp, event: workflow.triggerEvent },
    actions: actions.map((action: any) => ({ app: action.app, task: action.action || action.task })),
    active: workflow.enabled,
    createdAt: new Date(workflow.createdAt).toISOString(),
    updatedAt: workflow.updatedAt ? new Date(workflow.updatedAt).toISOString() : undefined,
    executions: workflow.executionCount || 0,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    if (req.method === 'GET') return res.status(200).json({ success: true, data: [], meta: emptyMeta });
    return res.status(401).json({ success: false, error: 'Sign in before creating a workflow.' });
  }

  try {
    if (req.method === 'GET') {
      const workflows = await prisma.workflow.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
      const data = workflows.map(toWorkflowResponse);
      return res.status(200).json({
        success: true,
        data,
        meta: {
          total: data.length,
          active: data.filter((workflow) => workflow.active).length,
          totalExecutions: data.reduce((sum, workflow) => sum + (workflow.executions || 0), 0),
        },
      });
    }

    const { name, trigger, actions } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 200 || !trigger?.app || !trigger?.event || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields: name, trigger.app, trigger.event, actions' });
    }

    const triggerApp = String(trigger.app).toLowerCase();
    const connectedApp = await prisma.appToken.findUnique({ where: { userId_appName: { userId, appName: triggerApp } }, select: { connected: true } });
    if (!connectedApp?.connected) return res.status(400).json({ success: false, error: `${trigger.app} is not connected. Please connect it first.` });

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name: name.trim(),
        triggerApp,
        triggerEvent: String(trigger.event),
        triggerConfig: trigger.config || {},
        actions: actions.map((action: any) => ({ app: action.app, action: action.task || action.action, config: action.config || {} })),
        enabled: true,
      },
    });
    return res.status(201).json({ success: true, data: toWorkflowResponse(workflow), message: 'Workflow created successfully' });
  } catch (error) {
    console.error('Workflow API error:', error);
    return res.status(503).json({ success: false, error: 'Workflow service is temporarily unavailable.' });
  }
}
