import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${method} Not Allowed`,
    });
  }

  // TODO: Get real user ID from session
  const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - No user session',
    });
  }

  try {
    // REAL metrics from database - NO MOCK DATA
    const [
      connectedAppsData,
      workflows,
      recentExecutions,
      notifications,
    ] = await Promise.all([
      // Connected apps count
      prisma.appToken.count({
        where: { userId, connected: true },
      }),

      // Workflows data
      prisma.workflow.findMany({
        where: { userId },
        select: { enabled: true, executionCount: true },
      }),

      // Recent workflow executions (last 7 days)
      prisma.workflowExecution.count({
        where: {
          workflow: { userId },
          startedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Notification stats (last 7 days)
      prisma.notification.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const activeWorkflows = workflows.filter(w => w.enabled).length;
    const totalExecutions = workflows.reduce((sum, w) => sum + w.executionCount, 0);

    // Calculate time saved (rough estimate: 2 minutes per execution)
    const timeSavedMinutes = totalExecutions * 2;
    const timeSavedHours = Math.round((timeSavedMinutes / 60) * 10) / 10;

    return res.status(200).json({
      success: true,
      data: {
        connectedApps: connectedAppsData,
        totalApps: 8, // Total available apps
        activeWorkflows,
        totalWorkflows: workflows.length,
        timeSaved: timeSavedHours,
        notificationsProcessed: notifications,
        workflowExecutions: recentExecutions,
        lastSync: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
