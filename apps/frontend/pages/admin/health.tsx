import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import MetricCard from '../../components/admin/MetricCard';
import StatusPill, { toneForStatus } from '../../components/admin/StatusPill';

interface IntegrationHealth {
  id: string;
  name: string;
  configured: boolean;
  connected: number;
  expired: number;
  needsReconnect: number;
  lastUsedAt: string | null;
  status: 'healthy' | 'attention' | 'idle' | 'not_configured';
}

interface HealthResponse {
  checkedAt: string;
  integrations: IntegrationHealth[];
  totals: { connected: number; expired: number; needsReconnect: number; configuredProviders: number; providersWithIssues: number };
  executions: { failed24h: number; failed7d: number };
  recentFailures: Array<{
    id: string;
    error: string | null;
    startedAt: string;
    workflowId: string | null;
    workflowName: string | null;
    userEmail: string | null;
  }>;
}

const STATUS_LABEL: Record<IntegrationHealth['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  attention: { label: 'Needs attention', tone: 'danger' },
  idle: { label: 'No connections yet', tone: 'neutral' },
  not_configured: { label: 'Not configured', tone: 'neutral' },
};

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/health');
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load integration health.');
      setData(body.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load integration health.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell
      title="Integration health"
      description="Token state per provider and the most recent execution failures. Derived from stored tokens — no live provider calls are made."
      actions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-800"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <section aria-label="Integration totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Connected accounts" value={data?.totals.connected ?? null} hint="Across all providers" loading={loading && !data} />
          <MetricCard
            label="Expired tokens"
            value={data?.totals.expired ?? null}
            hint="Access token past expiry"
            tone={data && data.totals.expired > 0 ? 'danger' : 'default'}
            icon={AlertTriangle}
            loading={loading && !data}
          />
          <MetricCard
            label="Need reconnect"
            value={data?.totals.needsReconnect ?? null}
            hint="No refresh token stored"
            tone={data && data.totals.needsReconnect > 0 ? 'warning' : 'default'}
            loading={loading && !data}
          />
          <MetricCard
            label="Failed executions"
            value={data?.executions.failed24h ?? null}
            hint={data ? `${data.executions.failed7d} in 7 days` : undefined}
            tone={data && data.executions.failed24h > 0 ? 'warning' : 'default'}
            loading={loading && !data}
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
          <header className="border-b border-neutral-200 px-5 py-4 dark:border-dark-700">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Providers</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-dark-900 dark:text-neutral-400">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Provider</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Connected</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Expired</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Reconnect</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Last used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-700">
                {(data?.integrations ?? []).map((integration) => {
                  const meta = STATUS_LABEL[integration.status];
                  return (
                    <tr key={integration.id} className="hover:bg-neutral-50 dark:hover:bg-dark-900/60">
                      <td className="px-5 py-3">
                        <p className="font-medium text-neutral-900 dark:text-white">{integration.name}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {integration.configured ? 'credentials configured' : 'credentials missing'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-neutral-900 dark:text-white">{integration.connected}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${integration.expired > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {integration.expired}
                      </td>
                      <td className={`px-5 py-3 text-right tabular-nums ${integration.needsReconnect > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {integration.needsReconnect}
                      </td>
                      <td className="px-5 py-3 text-neutral-500 dark:text-neutral-400">
                        {integration.lastUsedAt ? new Date(integration.lastUsedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
                {!loading && (data?.integrations.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      No integrations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
          <header className="border-b border-neutral-200 px-5 py-4 dark:border-dark-700">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Recent execution failures
            </h2>
          </header>
          <div className="divide-y divide-neutral-200 dark:divide-dark-700">
            {(data?.recentFailures ?? []).length === 0 && (
              <p className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                No failed executions in the last 7 days.
              </p>
            )}
            {(data?.recentFailures ?? []).map((failure) => (
              <div key={failure.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{failure.workflowName ?? 'Deleted workflow'}</p>
                  <StatusPill tone={toneForStatus('FAILED')}>FAILED</StatusPill>
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {failure.userEmail ?? 'unknown user'} · {new Date(failure.startedAt).toLocaleString()}
                </p>
                {failure.error && (
                  <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-2 text-xs text-red-700 dark:bg-dark-900 dark:text-red-300">
                    {failure.error}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
