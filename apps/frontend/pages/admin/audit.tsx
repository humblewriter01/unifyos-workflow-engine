import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';

interface AuditRow {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (nextCursor: string | null, append: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (nextCursor) params.set('cursor', nextCursor);
      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load the audit trail.');
      setRows((previous) => (append ? [...previous, ...body.data] : body.data));
      setCursor(body.meta?.nextCursor ?? null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the audit trail.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  return (
    <AdminShell
      title="Audit log"
      description="Every privileged action with the acting administrator's email, the target, and a timestamp."
      actions={
        <button
          type="button"
          onClick={() => void load(null, false)}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-800"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-dark-900 dark:text-neutral-400">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">When</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Admin</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Target</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-700">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-neutral-50 dark:hover:bg-dark-900/60">
                    <td className="whitespace-nowrap px-5 py-3 text-neutral-600 dark:text-neutral-400">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-medium text-neutral-900 dark:text-white">{row.action}</td>
                    <td className="px-5 py-3 text-neutral-700 dark:text-neutral-300">{row.adminEmail}</td>
                    <td className="px-5 py-3 text-neutral-500 dark:text-neutral-400">
                      {row.targetType ?? '—'}
                      {row.targetId ? <span className="block font-mono text-xs">{row.targetId.slice(0, 12)}…</span> : null}
                    </td>
                    <td className="px-5 py-3">
                      {Object.keys(row.metadata).length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                            aria-expanded={expanded === row.id}
                            className="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
                          >
                            {expanded === row.id ? 'Hide' : 'View'}
                          </button>
                          {expanded === row.id && (
                            <pre className="mt-2 max-h-48 max-w-md overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-2 text-xs text-neutral-700 dark:bg-dark-900 dark:text-neutral-300">
                              {JSON.stringify(row.metadata, null, 2)}
                            </pre>
                          )}
                        </>
                      )}
                      {row.ipAddress && <span className="mt-1 block text-[10px] text-neutral-400">from {row.ipAddress}</span>}
                    </td>
                  </tr>
                ))}
                {loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      No admin actions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {cursor && (
            <div className="border-t border-neutral-200 px-5 py-3 text-center dark:border-dark-700">
              <button
                type="button"
                onClick={() => void load(cursor, true)}
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
