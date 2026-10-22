import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../../lib/admin-auth';
import prisma from '../../../../lib/prisma';

/**
 * Every workflow on the platform, for the global management table.
 *
 * Read-only here; enable/disable lives on `/api/admin/workflows/[id]`.
 * Cursor pagination on `createdAt` keeps deep pages cheap (offset pagination
 * would rescan). `q` searches workflow name and owner email.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';

  const where = {
    ...(status === 'enabled' ? { enabled: true } : status === 'disabled' ? { enabled: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { user: { email: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
    ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
  };

  try {
    const [rows, total, enabled] = await Promise.all([
      prisma.workflow.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: {
          id: true,
          name: true,
          description: true,
          triggerApp: true,
          triggerEvent: true,
          enabled: true,
          executionCount: true,
          lastExecutedAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, plan: true } },
          _count: { select: { executions: true } },
        },
      }),
      prisma.workflow.count(),
      prisma.workflow.count({ where: { enabled: true } }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return res.status(200).json({
      success: true,
      data: page,
      meta: {
        total,
        enabled,
        disabled: total - enabled,
        nextCursor: hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null,
      },
    });
  } catch (error) {
    console.error('Admin workflows error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'ADMIN_WORKFLOWS_UNAVAILABLE', message: 'Workflows are temporarily unavailable.' },
    });
  }
}
