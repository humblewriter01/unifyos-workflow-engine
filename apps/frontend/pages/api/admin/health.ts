import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/admin-auth';
import prisma from '../../../lib/prisma';
import { INTEGRATIONS, getIntegrationStatus } from '../../../lib/integrations';

/**
 * Integration health monitor.
 *
 * Derived entirely from `AppToken` + `WorkflowExecution` — no new tables and no
 * live calls to providers (that would need per-provider rate limiting and would
 * make this endpoint slow and flaky).
 *
 * What it answers:
 *   "Google Workspace: 45 connected, 2 expired tokens"
 *   "Slack: 12 connected, 3 need reconnecting (refresh token missing)"
 */

export interface IntegrationHealth {
  id: string;
  name: string;
  configured: boolean;
  connected: number;
  expired: number;
  needsReconnect: number;
  lastUsedAt: string | null;
  status: 'healthy' | 'attention' | 'idle' | 'not_configured';
}

const DISPLAY_NAMES: Record<string, string> = {
  google: 'Google Workspace',
  gmail: 'Gmail (legacy)',
  calendar: 'Google Calendar (legacy)',
  slack: 'Slack',
  notion: 'Notion',
  trello: 'Trello',
  asana: 'Asana',
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  monday: 'Monday.com',
};

function displayName(id: string): string {
  const known = DISPLAY_NAMES[id];
  if (known) return known;
  return INTEGRATIONS.find((integration) => integration.id === id)?.name ?? id.replace(/^\w/, (c) => c.toUpperCase());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const now = Date.now();
    const [tokens, failed24h, failed7d, failureSample] = await Promise.all([
      prisma.appToken.findMany({
        select: { appName: true, connected: true, expiresAt: true, refreshToken: true, lastUsedAt: true, createdAt: true },
      }),
      prisma.workflowExecution.count({ where: { status: 'FAILED', startedAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } }),
      prisma.workflowExecution.count({ where: { status: 'FAILED', startedAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.workflowExecution.findMany({
        where: { status: 'FAILED', startedAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          error: true,
          startedAt: true,
          workflow: { select: { id: true, name: true, user: { select: { email: true } } } },
        },
      }),
    ]);

    // Every provider we know about (registry) plus anything that actually holds
    // a token, so a provider removed from the registry still shows up.
    const ids = new Set<string>(INTEGRATIONS.map((integration) => integration.id));
    for (const token of tokens) ids.add(token.appName);

    const integrations: IntegrationHealth[] = Array.from(ids)
      .sort()
      .map((id) => {
      const rows = tokens.filter((token) => token.appName === id);
      const connectedRows = rows.filter((token) => token.connected);
      const expired = connectedRows.filter((token) => token.expiresAt !== null && token.expiresAt.getTime() <= now).length;
      // Google-style providers return a refresh token; a connected row without
      // one cannot survive the access-token lifetime and needs a new consent.
      const needsReconnect = connectedRows.filter((token) => !token.refreshToken).length;
      const lastUsed = rows
        .map((token) => token.lastUsedAt)
        .filter((value): value is Date => value !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      const configured = getIntegrationStatus(id)?.configured ?? false;
      const status: IntegrationHealth['status'] = !configured
        ? 'not_configured'
        : expired > 0 || needsReconnect > 0
          ? 'attention'
          : connectedRows.length > 0
            ? 'healthy'
            : 'idle';

      return {
        id,
        name: displayName(id),
        configured,
        connected: connectedRows.length,
        expired,
        needsReconnect,
        lastUsedAt: lastUsed ? lastUsed.toISOString() : null,
        status,
      };
    });

    const totals = integrations.reduce(
      (acc, integration) => ({
        connected: acc.connected + integration.connected,
        expired: acc.expired + integration.expired,
        needsReconnect: acc.needsReconnect + integration.needsReconnect,
        configuredProviders: acc.configuredProviders + (integration.configured ? 1 : 0),
        providersWithIssues: acc.providersWithIssues + (integration.status === 'attention' ? 1 : 0),
      }),
      { connected: 0, expired: 0, needsReconnect: 0, configuredProviders: 0, providersWithIssues: 0 },
    );

    return res.status(200).json({
      success: true,
      data: {
        checkedAt: new Date().toISOString(),
        integrations,
        totals,
        executions: { failed24h, failed7d },
        recentFailures: failureSample.map((row) => ({
          id: row.id,
          error: row.error ? row.error.slice(0, 500) : null,
          startedAt: row.startedAt,
          workflowId: row.workflow?.id ?? null,
          workflowName: row.workflow?.name ?? null,
          userEmail: row.workflow?.user?.email ?? null,
        })),
      },
    });
  } catch (error) {
    console.error('Admin health error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'ADMIN_HEALTH_UNAVAILABLE', message: 'Integration health is temporarily unavailable.' },
    });
  }
}
