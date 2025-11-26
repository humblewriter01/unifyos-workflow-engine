import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  // TODO: Get real user ID from session
  const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - No user session',
    });
  }

  switch (method) {
    case 'GET':
      try {
        // REAL database query - NO MOCK DATA
        const workflows = await prisma.workflow.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { executions: true },
            },
          },
        });

        // Transform to match frontend interface
        const transformedWorkflows = workflows.map(w => ({
          id: w.id,
          name: w.name,
          trigger: {
            app: w.triggerApp,
            event: w.triggerEvent,
          },
          actions: (w.actions as any[]).map((a: any) => ({
            app: a.app,
            task: a.action || a.task,
          })),
          active: w.enabled,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
          executions: w.executionCount,
        }));

        const activeCount = workflows.filter(w => w.enabled).length;

        return res.status(200).json({
          success: true,
          data: transformedWorkflows,
          meta: {
            total: workflows.length,
            active: activeCount,
            totalExecutions: workflows.reduce((sum, w) => sum + w.executionCount, 0),
          },
        });
      } catch (error: any) {
        console.error('Failed to fetch workflows:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch workflows',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }

    case 'POST':
      try {
        // Create new workflow from builder
        const { name, trigger, actions } = req.body;

        if (!name || !trigger || !actions || actions.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: name, trigger, actions',
          });
        }

        // Validate trigger app is connected
        const connectedApp = await prisma.appToken.findUnique({
          where: {
            userId_appName: {
              userId,
              appName: trigger.app.toLowerCase(),
            },
          },
        });

        if (!connectedApp?.connected) {
          return res.status(400).json({
            success: false,
            error: `${trigger.app} is not connected. Please connect it first.`,
          });
        }

        // Create workflow in database
        const workflow = await prisma.workflow.create({
          data: {
            userId,
            name,
            triggerApp: trigger.app,
            triggerEvent: trigger.event,
            triggerConfig: trigger.config || {},
            actions: actions.map((a: any) => ({
              app: a.app,
              action: a.task || a.action,
              config: a.config || {},
            })),
            enabled: true,
          },
        });

        return res.status(201).json({
          success: true,
          data: {
            id: workflow.id,
            name: workflow.name,
            trigger: {
              app: workflow.triggerApp,
              event: workflow.triggerEvent,
            },
            actions: (workflow.actions as any[]).map((a: any) => ({
              app: a.app,
              task: a.action,
            })),
            active: workflow.enabled,
            createdAt: workflow.createdAt.toISOString(),
            executions: 0,
          },
          message: 'Workflow created successfully',
        });
      } catch (error: any) {
        console.error('Failed to create workflow:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to create workflow',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`,
      });
  }
}
