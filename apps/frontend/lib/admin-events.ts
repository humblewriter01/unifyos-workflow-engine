import type { NextApiRequest } from 'next';
import prisma from './prisma';

/**
 * Admin event log.
 *
 * `admin_audit_logs` serves two purposes:
 *
 * 1. **Audit trail** — one immutable row per privileged action.
 * 2. **Singleton state** — the newest row for a reserved action name is the
 *    current value of that switch (kill switch, announcement, …).
 *
 * (2) exists because this change set is only permitted to add the
 * `admin_audit_logs` and `promo_codes` tables: there is no settings table to
 * put platform-wide flags in. Reading a switch is therefore a single indexed
 * query on `(action, createdAt DESC)`; see `lib/platform-controls.ts`.
 *
 * State rows are the only rows ever updated in place, and each update also
 * writes an audit row, so the trail stays complete.
 */

export interface AdminActor {
  id: string;
  email: string;
}

/** Actions that represent platform state rather than a one-off audit entry. */
export const STATE_ACTIONS = {
  killSwitch: 'platform.kill_switch',
  announcement: 'platform.announcement',
  supportTicket: 'support.ticket',
} as const;

export const AUDIT_ACTIONS = {
  userRoleChanged: 'admin.user.role_changed',
  userPlanChanged: 'admin.user.plan_changed',
  userPlanGranted: 'admin.user.plan_granted',
  subscriptionExtended: 'admin.user.subscription_extended',
  userImpersonated: 'admin.user.impersonated',
  workflowDisabled: 'admin.workflow.disabled',
  workflowEnabled: 'admin.workflow.enabled',
  promoCodeCreated: 'admin.promo.created',
  promoCodeUpdated: 'admin.promo.updated',
  promoCodeDeleted: 'admin.promo.deleted',
  promoCodeRedeemed: 'admin.promo.redeemed',
  announcementPublished: 'admin.announcement.published',
  announcementCleared: 'admin.announcement.cleared',
  emailBlastSent: 'admin.email.blast',
  supportTicketResolved: 'support.ticket_resolved',
} as const;

export interface LogEventArgs {
  actor: Pick<AdminActor, 'id' | 'email'> & { email: string };
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  req?: NextApiRequest;
}

export interface AdminEventRow {
  id: string;
  adminId: string | null;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}

function requestContext(req?: NextApiRequest) {
  if (!req) return { ipAddress: null as string | null, userAgent: null as string | null };
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ipAddress = raw ? raw.split(',')[0].trim().slice(0, 64) : (req.socket?.remoteAddress ?? null);
  const agent = req.headers['user-agent'];
  const userAgent = (Array.isArray(agent) ? agent[0] : agent)?.slice(0, 512) ?? null;
  return { ipAddress, userAgent };
}

export function readMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toRow(record: {
  id: string;
  adminId: string | null;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}): AdminEventRow {
  return { ...record, metadata: readMetadata(record.metadata) };
}

/**
 * Appends an audit row. Never throws: an audit failure must not turn a
 * successful admin action into a 500 for the operator.
 */
export async function logAdminEvent(args: LogEventArgs): Promise<string | null> {
  const { ipAddress, userAgent } = requestContext(args.req);
  try {
    const row = await prisma.adminAuditLog.create({
      data: {
        adminId: args.actor.id || null,
        adminEmail: args.actor.email,
        action: args.action,
        targetType: args.targetType ?? null,
        targetId: args.targetId ?? null,
        metadata: (args.metadata ?? {}) as any,
        ipAddress,
        userAgent,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    console.error('[admin-events] failed to write audit row', {
      action: args.action,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

/** Newest row for a reserved state action, or null when never set. */
export async function getLatestStateRow(action: string): Promise<AdminEventRow | null> {
  const row = await prisma.adminAuditLog.findFirst({
    where: { action },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return row ? toRow(row) : null;
}

/** Merges new keys into a state row's metadata (used to resolve tickets). */
export async function patchEventMetadata(id: string, patch: Record<string, unknown>): Promise<void> {
  const current = await prisma.adminAuditLog.findUnique({ where: { id }, select: { metadata: true } });
  if (!current) return;
  await prisma.adminAuditLog.update({
    where: { id },
    data: { metadata: { ...readMetadata(current.metadata), ...patch } as any },
  });
}

export interface ListEventsOptions {
  actions?: string[];
  targetType?: string;
  targetId?: string;
  limit?: number;
  cursor?: string;
}

/** Cursor-paginated audit feed, newest first. */
export async function listAdminEvents(options: ListEventsOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = await prisma.adminAuditLog.findMany({
    where: {
      ...(options.actions?.length ? { action: { in: options.actions } } : {}),
      ...(options.targetType ? { targetType: options.targetType } : {}),
      ...(options.targetId ? { targetId: options.targetId } : {}),
      ...(options.cursor ? { createdAt: { lt: new Date(options.cursor) } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(toRow),
    nextCursor: hasMore ? page[page.length - 1]?.createdAt.toISOString() : null,
  };
}
