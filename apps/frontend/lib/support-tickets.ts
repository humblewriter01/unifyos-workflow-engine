import crypto from 'crypto';
import type { NextApiRequest } from 'next';
import prisma from './prisma';
import { AUDIT_ACTIONS, STATE_ACTIONS, logAdminEvent, patchEventMetadata, readMetadata, type AdminActor } from './admin-events';

/**
 * Support ticket store.
 *
 * The contact form previously only sent an email: if delivery failed, the
 * message was lost and there was no inbox to read it in. Tickets are now
 * persisted first and emailed second.
 *
 * They live in `admin_audit_logs` (action `support.ticket`) because this change
 * set is only permitted to add that table and `promo_codes`. The columns are
 * used as: `adminId`/`adminEmail` = the submitting user (the actor),
 * `targetId` = ticket id, `metadata` = the ticket body and its status.
 */

export type TicketStatus = 'open' | 'resolved';

export interface SupportTicket {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  status: TicketStatus;
  userId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface CreateTicketInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  userId?: string | null;
}

const MAX_MESSAGE = 10_000;

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Persists a ticket. Returns its id, or null if the write failed. */
export async function createSupportTicket(input: CreateTicketInput, req?: NextApiRequest): Promise<string | null> {
  const ticketId = crypto.randomUUID();
  const payload = {
    name: clean(input.name, 120),
    email: clean(input.email, 254),
    subject: clean(input.subject, 200),
    message: clean(input.message, MAX_MESSAGE),
    category: clean(input.category, 60) || 'general',
    status: 'open' as TicketStatus,
    userId: input.userId ?? null,
    resolvedAt: null,
    resolvedBy: null,
  };

  const id = await logAdminEvent({
    actor: { id: input.userId ?? '', email: payload.email },
    action: STATE_ACTIONS.supportTicket,
    targetType: 'support_ticket',
    targetId: ticketId,
    metadata: payload,
    req,
  });

  // logAdminEvent returns the row id; the ticket id is what callers reference.
  return id ? ticketId : null;
}

function toTicket(row: {
  id: string;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
}): SupportTicket {
  const meta = readMetadata(row.metadata);
  const status = meta.status === 'resolved' ? 'resolved' : 'open';
  return {
    id: row.targetId ?? row.id,
    name: typeof meta.name === 'string' ? meta.name : '',
    email: typeof meta.email === 'string' ? meta.email : '',
    subject: typeof meta.subject === 'string' ? meta.subject : '',
    message: typeof meta.message === 'string' ? meta.message : '',
    category: typeof meta.category === 'string' ? meta.category : 'general',
    status,
    userId: typeof meta.userId === 'string' ? meta.userId : null,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: typeof meta.resolvedAt === 'string' ? meta.resolvedAt : null,
    resolvedBy: typeof meta.resolvedBy === 'string' ? meta.resolvedBy : null,
  };
}

export async function listSupportTickets(options: { status?: TicketStatus | 'all'; limit?: number; cursor?: string } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = await prisma.adminAuditLog.findMany({
    where: {
      action: STATE_ACTIONS.supportTicket,
      ...(options.cursor ? { createdAt: { lt: new Date(options.cursor) } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    // Over-fetch so status filtering after the JSON read still fills a page.
    take: limit * 2 + 1,
  });

  const tickets = rows.map(toTicket);
  const filtered = options.status && options.status !== 'all' ? tickets.filter((ticket) => ticket.status === options.status) : tickets;
  const page = filtered.slice(0, limit);
  return {
    items: page,
    nextCursor: page.length === limit && rows.length > 0 ? page[page.length - 1].createdAt : null,
  };
}

export async function countSupportTickets(): Promise<{ open: number; resolved: number }> {
  const rows = await prisma.adminAuditLog.findMany({
    where: { action: STATE_ACTIONS.supportTicket },
    select: { metadata: true },
  });
  let open = 0;
  let resolved = 0;
  for (const row of rows) {
    if (readMetadata(row.metadata).status === 'resolved') resolved += 1;
    else open += 1;
  }
  return { open, resolved };
}

export async function resolveSupportTicket(
  ticketId: string,
  actor: AdminActor,
  req?: NextApiRequest,
): Promise<SupportTicket | null> {
  const row = await prisma.adminAuditLog.findFirst({
    where: { action: STATE_ACTIONS.supportTicket, targetId: ticketId },
    orderBy: [{ createdAt: 'desc' }],
  });
  if (!row) return null;

  const resolvedAt = new Date().toISOString();
  await patchEventMetadata(row.id, { status: 'resolved', resolvedAt, resolvedBy: actor.email });
  await logAdminEvent({
    actor,
    action: AUDIT_ACTIONS.supportTicketResolved,
    targetType: 'support_ticket',
    targetId: ticketId,
    metadata: { resolvedAt },
    req,
  });

  return toTicket({ ...row, metadata: { ...readMetadata(row.metadata), status: 'resolved', resolvedAt, resolvedBy: actor.email } });
}
