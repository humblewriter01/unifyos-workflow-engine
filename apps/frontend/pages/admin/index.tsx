import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Zap,
  Activity,
  AlertTriangle,
  Plug,
  CreditCard,
  Power,
  Play,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import MetricCard from '../../components/admin/MetricCard';
import StatusPill, { toneForStatus } from '../../components/admin/StatusPill';

interface Metrics {
  users: number;
  newUsers7d: number;
  verifiedUsers: number;
  mfaUsers: number;
  usersByPlan: Record<string, number>;
  workflows: number;
  enabledWorkflows: number;
  executions: number;
  executions24h: number;
  executions7d: number;
  executionsByStatus: Record<string, number>;
  successRate: number | null;
  avgDurationMs: number | null;
  connectedApps: number;
  connectedByApp: Record<string, number>;
  plans: number;
  activeSubscriptions: number;
  successfulPayments: number;
  revenueByCurrency: Array<{ currency: string; amount: number }>;
}

interface OverviewResponse {
  metrics: Metrics;
  trend: Array<{ day: string; total: number; failed: number; success: number }>;
  recentAudit: Array<{ id: string; adminEmail: string; action: string; targetId: string | null; createdAt: string }>;
  recentExecutions: Array<{
    id: string;
    status: string;
    startedAt: string;
    duration: number | null;
    workflow: { id: string; name: string; user: { email: string } | null } | null;
  }>;
}

interface KillSwitchState {
  enabled: boolean;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

const money = (currency: string, minor: number) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState('');
  const [killSwitch, setKillSwitch] = useState<KillSwitchState | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [overview, kill] = await Promise.all([fetch('/api/admin/overview'), fetch('/api/admin/kill-switch?fresh=1')]);
      const body = await overview.json();
      if (!overview.ok) throw new Error(body?.error?.message || 'Unable to load metrics.');
      setData(body.data);
      if (kill.ok) {
        const killBody = await kill.json();
        setKillSwitch(killBody.data.state);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load metrics.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleKillSwitch(enabled: boolean) {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, reason: enabled ? reason.trim() : null }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The kill switch could not be updated.');
        return;
      }
      setKillSwitch(body.data.state);
      setNotice(body.message || 'Updated.');
      setConfirming(false);
      setReason('');
    } catch {
      setNotice('The kill switch could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  const m = data?.metrics;
  const maxTrend = Math.max(1, ...(data?.trend ?? []).map((day) => day.total));

  return (
    <AdminShell
      title="Administration"
      description="Platform health, execution controls, and the administrative audit trail."
      actions={
        <Link
          href="/admin/workflows"
          className="inline-flex min-h-[40px] items-center rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-800"
        >
          Manage workflows
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Kill switch */}
        <section
          className={`rounded-xl border p-5 ${
            killSwitch?.enabled
              ? 'border-red-300 bg-red-50 dark:border-red-800/60 dark:bg-red-900/20'
              : 'border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800'
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Power
                  className={`h-5 w-5 ${killSwitch?.enabled ? 'text-red-600 dark:text-red-400' : 'text-neutral-400'}`}
                  aria-hidden="true"
                />
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Global workflow kill switch</h2>
                <StatusPill tone={killSwitch?.enabled ? 'danger' : 'success'}>
                  {killSwitch === null ? 'unknown' : killSwitch.enabled ? 'Executions paused' : 'Executions running'}
                </StatusPill>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
                When paused, every execution path refuses to start for all users. Individual workflows are not modified —
                this is a platform-wide override.
              </p>
              {killSwitch?.enabled && killSwitch.reason && (
                <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-300">Reason: {killSwitch.reason}</p>
              )}
              {killSwitch?.updatedAt && (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Last changed {new Date(killSwitch.updatedAt).toLocaleString()} by {killSwitch.updatedBy}
                </p>
              )}
            </div>

            <div className="shrink-0">
              {killSwitch?.enabled ? (
                <button
                  type="button"
                  onClick={() => void toggleKillSwitch(false)}
                  disabled={busy}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Resume all executions
                </button>
              ) : confirming ? (
                <div className="w-full space-y-2 sm:w-72">
                  <label htmlFor="pause-reason" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Reason (required, stored in the audit log)
                  </label>
                  <input
                    id="pause-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    placeholder="e.g. Paystack incident — pausing outbound API calls"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleKillSwitch(true)}
                      disabled={busy || reason.trim().length === 0}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Pause everything
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="min-h-[40px] rounded-lg border border-neutral-300 px-3 text-sm font-medium dark:border-dark-600 dark:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  <Power className="h-4 w-4" />
                  Pause all executions
                </button>
              )}
            </div>
          </div>
          {notice && (
            <p role="status" className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
              {notice}
            </p>
          )}
        </section>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Metrics */}
        <section aria-label="Platform metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total users" value={m?.users ?? null} hint={m ? `${m.newUsers7d} new in 7 days` : undefined} icon={Users} loading={!m && !error} />
          <MetricCard label="Workflows" value={m?.workflows ?? null} hint={m ? `${m.enabledWorkflows} enabled` : undefined} icon={Zap} loading={!m && !error} />
          <MetricCard label="Executions" value={m?.executions ?? null} hint={m ? `${m.executions24h} in 24h · ${m.executions7d} in 7d` : undefined} icon={Activity} loading={!m && !error} />
          <MetricCard
            label="Success rate"
            value={m?.successRate === null || m?.successRate === undefined ? null : `${m.successRate}%`}
            hint={m ? `${m.executionsByStatus?.FAILED ?? 0} failed total` : undefined}
            icon={TrendingUp}
            tone={m?.successRate !== null && m?.successRate !== undefined && m.successRate < 90 ? 'warning' : 'positive'}
            loading={!m && !error}
          />
          <MetricCard label="Connected apps" value={m?.connectedApps ?? null} hint={m ? `${Object.keys(m.connectedByApp).length} providers in use` : undefined} icon={Plug} loading={!m && !error} />
          <MetricCard label="Active subscriptions" value={m?.activeSubscriptions ?? null} hint={m ? `${m.plans} plans configured` : undefined} icon={CreditCard} loading={!m && !error} />
          <MetricCard label="Verified users" value={m?.verifiedUsers ?? null} hint={m && m.users > 0 ? `${Math.round((m.verifiedUsers / m.users) * 100)}% of accounts` : undefined} icon={Users} loading={!m && !error} />
          <MetricCard label="Admin MFA coverage" value={m?.mfaUsers ?? null} hint="Accounts with TOTP enabled" icon={AlertTriangle} loading={!m && !error} />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Trend */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-2 dark:border-dark-700 dark:bg-dark-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Executions · last 7 days
            </h2>
            <div className="mt-4 flex h-36 items-end gap-2" role="img" aria-label="Executions per day for the last seven days">
              {(data?.trend ?? Array.from({ length: 7 }, (_, i) => ({ day: `d${i}`, total: 0, failed: 0, success: 0 }))).map((day) => (
                <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t bg-primary-500/80 dark:bg-primary-500/70"
                    style={{ height: `${Math.max(day.total === 0 ? 2 : 8, (day.total / maxTrend) * 100)}%` }}
                    title={`${day.day}: ${day.total} executions (${day.failed} failed)`}
                  />
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{day.day.slice(5)}</span>
                </div>
              ))}
            </div>
            {m && m.revenueByCurrency.length > 0 && (
              <p className="mt-4 border-t border-neutral-200 pt-3 text-sm text-neutral-600 dark:border-dark-700 dark:text-neutral-400">
                Successful payments:{' '}
                {m.revenueByCurrency.map((row) => money(row.currency, row.amount)).join(' · ')}
              </p>
            )}
          </section>

          {/* Plans */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Users by plan</h2>
            <ul className="mt-4 space-y-3">
              {['FREE', 'PRO', 'BUSINESS'].map((plan) => {
                const count = m?.usersByPlan?.[plan] ?? 0;
                const pct = m && m.users > 0 ? Math.round((count / m.users) * 100) : 0;
                return (
                  <li key={plan}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-neutral-700 dark:text-neutral-200">{plan}</span>
                      <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                        {count} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-dark-700">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
            <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-dark-700">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Recent executions</h2>
              <Link href="/admin/audit" className="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400">
                Audit log
              </Link>
            </header>
            <div className="divide-y divide-neutral-200 dark:divide-dark-700">
              {(data?.recentExecutions ?? []).length === 0 && (
                <p className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">No executions recorded yet.</p>
              )}
              {(data?.recentExecutions ?? []).map((execution) => (
                <div key={execution.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900 dark:text-white">{execution.workflow?.name ?? 'Deleted workflow'}</p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {execution.workflow?.user?.email ?? 'unknown user'} · {new Date(execution.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusPill tone={toneForStatus(execution.status)}>{execution.status}</StatusPill>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
            <header className="border-b border-neutral-200 px-5 py-4 dark:border-dark-700">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Recent admin activity</h2>
            </header>
            <div className="divide-y divide-neutral-200 dark:divide-dark-700">
              {(data?.recentAudit ?? []).length === 0 && (
                <p className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">No admin actions logged yet.</p>
              )}
              {(data?.recentAudit ?? []).map((entry) => (
                <div key={entry.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-neutral-900 dark:text-white">{entry.action}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {entry.adminEmail} · {new Date(entry.createdAt).toLocaleString()}
                    {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}…` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
