import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, Ban, CheckCircle2 } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import StatusPill from '../../components/admin/StatusPill';

interface AdminWorkflow {
  id: string;
  name: string;
  description: string | null;
  triggerApp: string;
  triggerEvent: string;
  enabled: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; plan: string } | null;
  _count: { executions: number };
}

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState<AdminWorkflow[]>([]);
  const [meta, setMeta] = useState<{ total: number; enabled: number; disabled: number; nextCursor: string | null } | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status, limit: '50' });
        if (query.trim()) params.set('q', query.trim());
        if (cursor) params.set('cursor', cursor);
        const response = await fetch(`/api/admin/workflows?${params.toString()}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message || 'Unable to load workflows.');
        setWorkflows((previous) => (append ? [...previous, ...body.data] : body.data));
        setMeta(body.meta);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load workflows.');
      } finally {
        setLoading(false);
      }
    },
    [query, status],
  );

  useEffect(() => {
    const timer = setTimeout(() => void fetchPage(null, false), 250);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  async function setEnabled(workflow: AdminWorkflow, enabled: boolean) {
    setPendingId(workflow.id);
    setNotice('');
    try {
      const response = await fetch(`/api/admin/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The workflow could not be updated.');
        return;
      }
      setWorkflows((previous) => previous.map((row) => (row.id === workflow.id ? { ...row, enabled } : row)));
      setNotice(body.message || 'Updated.');
    } catch {
      setNotice('The workflow could not be updated.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AdminShell
      title="All workflows"
      description="Every automation on the platform. Disable one to stop it from running (for example when it is spamming a provider API)."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by workflow or owner email"
              aria-label="Search workflows"
              className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-neutral-300 p-1 dark:border-dark-600" role="group" aria-label="Filter by state">
            {(['all', 'enabled', 'disabled'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                aria-pressed={status === value}
                className={`min-h-[34px] rounded-md px-3 text-sm font-medium capitalize ${
                  status === value ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-dark-800'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {meta && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {meta.total} workflows · {meta.enabled} enabled · {meta.disabled} disabled
          </p>
        )}

        {notice && (
          <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-dark-900 dark:text-neutral-400">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Workflow</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Owner</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Trigger</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Runs</th>
                  <th scope="col" className="px-5 py-3 font-semibold">State</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-700">
                {workflows.map((workflow) => (
                  <tr key={workflow.id} className="align-top hover:bg-neutral-50 dark:hover:bg-dark-900/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-neutral-900 dark:text-white">{workflow.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        created {new Date(workflow.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-neutral-900 dark:text-white">{workflow.user?.email ?? 'deleted user'}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{workflow.user?.plan ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="capitalize text-neutral-700 dark:text-neutral-300">{workflow.triggerApp}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{workflow.triggerEvent}</p>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                      {workflow.executionCount}
                      <span className="block text-xs text-neutral-400">{workflow._count.executions} logged</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={workflow.enabled ? 'success' : 'neutral'}>{workflow.enabled ? 'Enabled' : 'Disabled'}</StatusPill>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void setEnabled(workflow, !workflow.enabled)}
                        disabled={pendingId === workflow.id}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-60 ${
                          workflow.enabled
                            ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20'
                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20'
                        }`}
                      >
                        {pendingId === workflow.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : workflow.enabled ? (
                          <Ban className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {workflow.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                )}
                {!loading && workflows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      No workflows match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {meta?.nextCursor && (
            <div className="border-t border-neutral-200 px-5 py-3 text-center dark:border-dark-700">
              <button
                type="button"
                onClick={() => void fetchPage(meta.nextCursor, true)}
                className="text-sm font-semibold text-primary-600 hover:underline dark:text-primary-400"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
