import type { NextApiRequest } from 'next';
import { AUDIT_ACTIONS, STATE_ACTIONS, getLatestStateRow, logAdminEvent, type AdminActor } from './admin-events';

/**
 * Global dashboard announcements.
 *
 * Same singleton pattern as the kill switch: the newest `platform.announcement`
 * row in `admin_audit_logs` is the current banner. Publishing appends a row,
 * clearing appends an `active: false` row (so the history of what was shown,
 * when, and by whom stays intact).
 */

export type AnnouncementTone = 'info' | 'success' | 'warning' | 'critical';

export interface Announcement {
  id: string;
  message: string;
  tone: AnnouncementTone;
  publishedAt: string;
  publishedBy: string;
  expiresAt: string | null;
}

const TONES: AnnouncementTone[] = ['info', 'success', 'warning', 'critical'];

export function isAnnouncementTone(value: unknown): value is AnnouncementTone {
  return typeof value === 'string' && (TONES as string[]).includes(value);
}

export async function getActiveAnnouncement(): Promise<Announcement | null> {
  const row = await getLatestStateRow(STATE_ACTIONS.announcement);
  if (!row) return null;

  const meta = row.metadata;
  if (meta.active !== true) return null;
  if (typeof meta.message !== 'string' || !meta.message) return null;

  const expiresAt = typeof meta.expiresAt === 'string' ? meta.expiresAt : null;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return null;

  return {
    id: row.id,
    message: meta.message,
    tone: isAnnouncementTone(meta.tone) ? meta.tone : 'info',
    publishedAt: row.createdAt.toISOString(),
    publishedBy: row.adminEmail,
    expiresAt,
  };
}

export async function publishAnnouncement(input: {
  message: string;
  tone: AnnouncementTone;
  expiresAt: string | null;
  actor: AdminActor;
  req?: NextApiRequest;
}): Promise<Announcement | null> {
  await logAdminEvent({
    actor: input.actor,
    action: STATE_ACTIONS.announcement,
    targetType: 'platform',
    targetId: 'announcement',
    metadata: { active: true, message: input.message, tone: input.tone, expiresAt: input.expiresAt },
    req: input.req,
  });
  await logAdminEvent({
    actor: input.actor,
    action: AUDIT_ACTIONS.announcementPublished,
    targetType: 'platform',
    targetId: 'announcement',
    metadata: { tone: input.tone, length: input.message.length, expiresAt: input.expiresAt },
    req: input.req,
  });
  return getActiveAnnouncement();
}

export async function clearAnnouncement(input: { actor: AdminActor; req?: NextApiRequest }): Promise<void> {
  await logAdminEvent({
    actor: input.actor,
    action: STATE_ACTIONS.announcement,
    targetType: 'platform',
    targetId: 'announcement',
    metadata: { active: false },
    req: input.req,
  });
  await logAdminEvent({
    actor: input.actor,
    action: AUDIT_ACTIONS.announcementCleared,
    targetType: 'platform',
    targetId: 'announcement',
    metadata: {},
    req: input.req,
  });
}
