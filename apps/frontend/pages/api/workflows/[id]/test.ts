import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '../../../../lib/prisma';
import {
  assertWorkflowExecutionAllowed,
  pausedResponse,
  WorkflowExecutionPausedError,
} from '../../../../lib/platform-controls';

/**
 * Workflow test execution.
 *
 * Two things changed here beyond the kill switch:
 *
 * 1. The route was **unauthenticated** — anyone who knew a workflow id could
 *    POST to it. It now requires a session and checks that the workflow belongs
 *    to the caller.
 * 2. It now honours the platform kill switch and the workflow's own `enabled`
 *    flag before doing anything.
 *
 * There is still no real automation engine in this repository (`packages/engine`
 * is empty), so the run itself remains simulated — but it records a real
 * `WorkflowExecution` row tagged `source: "test"` so the admin execution log and
 * the dashboard counters have something truthful to show.
 *
 * ANY future executor (HTTP trigger, queue consumer, cron) must call
 * `assertWorkflowExecutionAllowed()` first — see lib/platform-controls.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to test a workflow.' } });
  }

  const workflowId = typeof req.query.id === 'string' ? req.query.id : '';
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, userId },
    select: { id: true, name: true, enabled: true, actions: true, triggerApp: true },
  });
  if (!workflow) {
    return res.status(404).json({ success: false, error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found.' } });
  }

  // Platform-wide pause wins over everything.
  try {
    await assertWorkflowExecutionAllowed();
  } catch (error) {
    if (error instanceof WorkflowExecutionPausedError) {
      return res.status(423).json(pausedResponse(error));
    }
    throw error;
  }

  if (!workflow.enabled) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'WORKFLOW_DISABLED',
        message: 'This workflow is disabled. Re-enable it before testing.',
      },
    });
  }

  const actionCount = Array.isArray(workflow.actions) ? workflow.actions.length : 0;
  const startedAt = new Date();

  try {
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        status: 'SUCCESS',
        triggerData: { source: 'test', simulated: true, triggerApp: workflow.triggerApp },
        results: { simulated: true, actionsExecuted: actionCount },
        startedAt,
        completedAt: new Date(),
        duration: Math.max(1, Date.now() - startedAt.getTime()),
      },
      select: { id: true, status: true, startedAt: true, completedAt: true, duration: true },
    });

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: { executionCount: { increment: 1 }, lastExecutedAt: startedAt },
    });

    return res.status(200).json({
      success: true,
      data: {
        workflowId: workflow.id,
        executionId: execution.id,
        simulated: true,
        testResult: { triggerFired: true, actionsExecuted: actionCount, duration: execution.duration ?? 0, status: 'success' },
      },
      message: 'Simulated workflow test completed. No provider APIs were called.',
    });
  } catch (error) {
    console.error('Workflow test error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'WORKFLOW_TEST_UNAVAILABLE', message: 'The workflow test could not be recorded.' },
    });
  }
}
