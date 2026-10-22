import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/admin-auth';
import prisma from '../../../lib/prisma';

/**
 * Admin overview: one round trip for every headline number.
 *
 * Kept on `/api/admin/overview` (rather than a new `/metrics` route) so the
 * existing endpoint stays the single source of truth; the response gained
 * fields, none were removed.
 *
 * No schema change was needed: `WorkflowExecution` already has indexes on
 * `status` and `startedAt`, and `Payment` on `status`.
 */

const DAY = 24 * 60 * 60 * 1000;

function bucketDays(rows: Array<{ startedAt: Date; status: string }>, days: number) {
  const buckets: Record<string, { day: string; total: number; failed: number; success: number }> = {};
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    buckets[day] = { day, total: 0, failed: 0, success: 0 };
  }
  for (const row of rows) {
    const day = row.startedAt.toISOString().slice(0, 10);
    const bucket = buckets[day];
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === 'FAILED') bucket.failed += 1;
    if (row.status === 'SUCCESS') bucket.success += 1;
  }
  return Object.values(buckets);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const now = Date.now();
  const since24h = new Date(now - DAY);
  const since7d = new Date(now - 7 * DAY);
  const since7dTrend = new Date(now - 7 * DAY);

  try {
    const [
      users,
      newUsers7d,
      verifiedUsers,
      mfaUsers,
      usersByPlan,
      workflows,
      enabledWorkflows,
      executionsTotal,
      executions24h,
      executions7d,
      executionsByStatus,
      durationAgg,
      appTokens,
      tokensByApp,
      plans,
      activeSubscriptions,
      successfulPayments,
      revenueByCurrency,
      recentAudit,
      recentExecutions,
      trendRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: since7d } } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { twoFactorEnabled: true } }),
      prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
      prisma.workflow.count(),
      prisma.workflow.count({ where: { enabled: true } }),
      prisma.workflowExecution.count(),
      prisma.workflowExecution.count({ where: { startedAt: { gte: since24h } } }),
      prisma.workflowExecution.count({ where: { startedAt: { gte: since7d } } }),
      prisma.workflowExecution.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.workflowExecution.aggregate({ _avg: { duration: true } }),
      prisma.appToken.count({ where: { connected: true } }),
      prisma.appToken.groupBy({ by: ['appName'], _count: { _all: true }, where: { connected: true } }),
      prisma.billingPlan.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.count({ where: { status: 'SUCCESS' } }),
      prisma.payment.groupBy({ by: ['currency'], _sum: { amount: true }, where: { status: 'SUCCESS' } }),
      prisma.adminAuditLog.findMany({
        orderBy: [{ createdAt: 'desc' }],
        take: 15,
        select: { id: true, adminEmail: true, action: true, targetType: true, targetId: true, createdAt: true, metadata: true },
      }),
      prisma.workflowExecution.findMany({
        orderBy: [{ startedAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          status: true,
          startedAt: true,
          duration: true,
          error: true,
          workflow: { select: { id: true, name: true, user: { select: { email: true } } } },
        },
      }),
      // Capped sample for the 7-day trend: enough for a sparkline without
      // scanning the whole table.
      prisma.workflowExecution.findMany({
        where: { startedAt: { gte: since7dTrend } },
        orderBy: { startedAt: 'desc' },
        take: 2000,
        select: { startedAt: true, status: true },
      }),
    ]);

    const statusRows: Array<{ status: string; _count: { _all: number } }> = executionsByStatus;
    const planRows: Array<{ plan: string; _count: { _all: number } }> = usersByPlan;
    const appRows: Array<{ appName: string; _count: { _all: number } }> = tokensByApp;

    const statusCounts = statusRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    const success = statusCounts.SUCCESS ?? 0;
    const failed = statusCounts.FAILED ?? 0;
    const finished = success + failed;

    const planCounts = planRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.plan] = row._count._all;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          users,
          newUsers7d,
          verifiedUsers,
          mfaUsers,
          usersByPlan: planCounts,
          workflows,
          enabledWorkflows,
          executions: executionsTotal,
          executions24h,
          executions7d,
          executionsByStatus: statusCounts,
          successRate: finished > 0 ? Math.round((success / finished) * 1000) / 10 : null,
          avgDurationMs: durationAgg._avg.duration ? Math.round(durationAgg._avg.duration) : null,
          connectedApps: appTokens,
          connectedByApp: appRows.reduce<Record<string, number>>((acc, row) => {
            acc[row.appName] = row._count._all;
            return acc;
          }, {}),
          plans,
          activeSubscriptions,
          successfulPayments,
          revenueByCurrency: revenueByCurrency.map((row) => ({
            currency: row.currency,
            amount: row._sum.amount ?? 0,
          })),
        },
        trend: bucketDays(trendRows, 7),
        recentAudit: recentAudit.map((row) => ({
          id: row.id,
          adminEmail: row.adminEmail,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          createdAt: row.createdAt,
          metadata: row.metadata,
        })),
        recentExecutions,
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'ADMIN_OVERVIEW_UNAVAILABLE', message: 'The admin overview is temporarily unavailable.' },
    });
  }
}
