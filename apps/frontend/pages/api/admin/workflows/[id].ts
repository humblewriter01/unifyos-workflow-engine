import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../../lib/admin-auth';
import { AUDIT_ACTIONS, logAdminEvent } from '../../../../lib/admin-events';
import prisma from '../../../../lib/prisma';

/**
 * GET   — one workflow with its owner and recent executions (row drawer).
 * PATCH — { enabled: boolean } to disable/enable another user's automation.
 *
 * Disabling is how an operator stops a workflow that is spamming a provider or
 * breaking the terms of service. Every change is audited with the admin's email.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    return res.status(400).json({ success: false, error: { code: 'WORKFLOW_ID_REQUIRED', message: 'A workflow id is required.' } });
  }

  if (req.method === 'GET') {
    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          triggerApp: true,
          triggerEvent: true,
          triggerConfig: true,
          actions: true,
          enabled: true,
          executionCount: true,
          lastExecutedAt: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, name: true, plan: true } },
          executions: {
            orderBy: { startedAt: 'desc' },
            take: 10,
            select: { id: true, status: true, startedAt: true, duration: true, error: true },
          },
        },
      });
      if (!workflow) {
        return res.status(404).json({ success: false, error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found.' } });
      }
      return res.status(200).json({ success: true, data: workflow });
    } catch (error) {
      console.error('Admin workflow detail error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'ADMIN_WORKFLOW_UNAVAILABLE', message: 'That workflow is temporarily unavailable.' },
      });
    }
  }

  if (req.method === 'PATCH') {
    // Killing another user's automation is a destructive action: SUPER_ADMIN only.
    const superAdmin = await requireAdmin(req, res, ['SUPER_ADMIN']);
    if (!superAdmin) return;

    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: '`enabled` must be a boolean.' } });
    }

    try {
      const current = await prisma.workflow.findUnique({ where: { id }, select: { id: true, name: true, enabled: true, userId: true } });
      if (!current) {
        return res.status(404).json({ success: false, error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found.' } });
      }

      const updated = await prisma.workflow.update({
        where: { id },
        data: { enabled },
        select: {
          id: true,
          name: true,
          enabled: true,
          executionCount: true,
          lastExecutedAt: true,
          user: { select: { id: true, email: true } },
        },
      });

      await logAdminEvent({
        actor: adminActor(superAdmin),
        action: enabled ? AUDIT_ACTIONS.workflowEnabled : AUDIT_ACTIONS.workflowDisabled,
        targetType: 'workflow',
        targetId: id,
        metadata: {
          workflowName: current.name,
          ownerId: current.userId,
          ownerEmail: updated.user?.email ?? null,
          from: current.enabled,
          to: enabled,
        },
        req,
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: enabled ? 'Workflow enabled.' : 'Workflow disabled. It will not run until re-enabled.',
      });
    } catch (error) {
      console.error('Admin workflow update error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'ADMIN_WORKFLOW_UPDATE_UNAVAILABLE', message: 'The workflow could not be updated.' },
      });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
}
