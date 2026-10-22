import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Copy, Loader2, Search, ShieldCheck, UserCog, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import StatusPill from '../../components/admin/StatusPill';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  adminRole: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  adminRole: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  executionCount: number;
  _count?: { workflows: number; notifications: number; payments: number };
  appTokens?: Array<{ appName: string; connected: boolean; expiresAt: string | null; lastUsedAt: string | null }>;
  subscriptions?: Array<{
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    plan: { key: string; name: string };
  }>;
  payments?: Array<{ id: string; reference: string; amount: number; currency: string; status: string; createdAt: string }>;
  recentAdminActions?: Array<{ id: string; action: string; adminEmail: string; createdAt: string }>;
}

const ROLES = ['NONE', 'SUPPORT_READONLY', 'BILLING_ADMIN', 'CATALOG_ADMIN', 'SUPER_ADMIN'];
const PLANS = ['FREE', 'PRO', 'BUSINESS'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [extendDays, setExtendDays] = useState('30');
  const [impersonation, setImpersonation] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load users.');
      setUsers(body.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(async (user: AdminUser) => {
    setSelected(user);
    setDetail(null);
    setImpersonation(null);
    setCopied(false);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load this account.');
      setDetail(body.data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load this account.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function patchUser(user: AdminUser, patch: Record<string, unknown>) {
    setPendingId(user.id);
    setNotice('');
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The user could not be updated.');
        return;
      }
      setUsers((previous) => previous.map((row) => (row.id === user.id ? { ...row, ...body.data } : row)));
      setDetail((previous) => (previous && previous.id === user.id ? { ...previous, ...body.data } : previous));
      setNotice(`Updated ${user.email}.`);
    } catch {
      setNotice('The user could not be updated.');
    } finally {
      setPendingId(null);
    }
  }

  async function extend(user: AdminUser) {
    const days = Number(extendDays);
    if (!Number.isInteger(days) || days === 0) {
      setNotice('Enter a non-zero number of days (negative values shorten the period).');
      return;
    }
    setNotice('');
    await patchUser(user, { extendSubscriptionDays: days });
    void openDetail(user);
  }

  async function impersonate(user: AdminUser) {
    setNotice('');
    setPendingId(user.id);
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'An impersonation link could not be created.');
        return;
      }
      setImpersonation({ url: body.data.url, expiresAt: body.data.expiresAt });
      setNotice('Single-use link created. It expires in 1 hour and never exposes the user’s password.');
    } catch {
      setNotice('An impersonation link could not be created.');
    } finally {
      setPendingId(null);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => user.email.toLowerCase().includes(needle) || (user.name ?? '').toLowerCase().includes(needle));
  }, [query, users]);

  const selectClass = 'rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white';

  return (
    <AdminShell
      title="Users"
      description="Accounts, plans, administrator roles, manual subscriptions and support impersonation. Every change is audited with your email address."
    >
      <div className="space-y-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email or name"
            aria-label="Search users"
            className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
          />
        </div>

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
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-dark-900 dark:text-neutral-400">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">User</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Plan</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Admin role</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Last login</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-700">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-dark-900/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-neutral-900 dark:text-white">{user.email}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {user.name || 'No name'} · joined {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusPill tone={user.emailVerified ? 'success' : 'warning'}>
                          {user.emailVerified ? 'Verified' : 'Unverified'}
                        </StatusPill>
                        <StatusPill tone={user.twoFactorEnabled ? 'success' : 'neutral'}>
                          {user.twoFactorEnabled ? 'MFA on' : 'MFA off'}
                        </StatusPill>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={user.plan}
                        disabled={pendingId === user.id}
                        onChange={(event) => void patchUser(user, { plan: event.target.value })}
                        aria-label={`Plan for ${user.email}`}
                        className={selectClass}
                      >
                        {PLANS.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={user.adminRole}
                        disabled={pendingId === user.id}
                        onChange={(event) => void patchUser(user, { adminRole: event.target.value })}
                        aria-label={`Admin role for ${user.email}`}
                        className={selectClass}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-neutral-500 dark:text-neutral-400">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'never'}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(user)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-900/60"
                      >
                        <UserCog className="h-3.5 w-3.5" aria-hidden="true" /> Open
                      </button>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      No users match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Showing {filtered.length} of {users.length} loaded accounts (most recent 100).
        </p>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`Manage ${selected.email}`}>
          <div className="w-full max-w-3xl space-y-4 rounded-xl bg-white p-5 shadow-xl dark:bg-dark-800">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-neutral-900 dark:text-white">{selected.email}</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {selected.name || 'No name'} · {selected.plan} · {selected.adminRole}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-300 dark:hover:bg-dark-900/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {detailLoading && (
              <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading account…
              </div>
            )}
            {detailError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
                {detailError}
              </p>
            )}

            {detail && (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Workflows</dt>
                    <dd className="font-semibold text-neutral-900 dark:text-white">{detail._count?.workflows ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Executions</dt>
                    <dd className="font-semibold text-neutral-900 dark:text-white">{detail.executionCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Payments</dt>
                    <dd className="font-semibold text-neutral-900 dark:text-white">{detail._count?.payments ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Connected apps</dt>
                    <dd className="font-semibold text-neutral-900 dark:text-white">
                      {(detail.appTokens ?? []).filter((token) => token.connected).length}
                    </dd>
                  </div>
                </dl>

                <section className="rounded-lg border border-neutral-200 p-4 dark:border-dark-700">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Subscription</h3>
                  {detail.subscriptions && detail.subscriptions.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm">
                      {detail.subscriptions.map((subscription) => (
                        <li key={subscription.id} className="flex flex-wrap items-center gap-2">
                          <StatusPill tone={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>{subscription.status}</StatusPill>
                          <span className="text-neutral-700 dark:text-neutral-200">{subscription.plan?.name ?? subscription.plan?.key}</span>
                          <span className="text-neutral-500 dark:text-neutral-400">
                            renews/ends{' '}
                            {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'not set'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      No subscription record. Change the Plan column to grant access manually.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" htmlFor="extend-days">
                        Extend by (days)
                      </label>
                      <input
                        id="extend-days"
                        type="number"
                        value={extendDays}
                        onChange={(event) => setExtendDays(event.target.value)}
                        className="mt-1 w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void extend(selected)}
                      disabled={pendingId === selected.id || !(detail.subscriptions && detail.subscriptions.length > 0)}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Extend period
                    </button>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Negative values shorten. Extending requires an existing subscription.
                    </p>
                  </div>
                </section>

                <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-900/20">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Sign in as this user
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                    Creates a single-use, one-hour session. The user’s password is never shown or needed. Use it only for support work, and stop
                    impersonating when you are done.
                  </p>
                  <button
                    type="button"
                    onClick={() => void impersonate(selected)}
                    disabled={pendingId === selected.id}
                    className="mt-2 inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {pendingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCog className="h-4 w-4" aria-hidden="true" />}
                    Generate impersonation link
                  </button>

                  {impersonation && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200" htmlFor="impersonation-url">
                        Single-use link (expires {new Date(impersonation.expiresAt).toLocaleTimeString()})
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="impersonation-url"
                          readOnly
                          value={impersonation.url}
                          onFocus={(event) => event.currentTarget.select()}
                          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-xs dark:border-amber-800 dark:bg-dark-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(impersonation.url);
                              setCopied(true);
                            } catch {
                              setCopied(false);
                            }
                          }}
                          className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <a
                        href={impersonation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-semibold text-amber-900 underline dark:text-amber-200"
                      >
                        Open in a new tab — this switches your own session until you stop impersonating
                      </a>
                    </div>
                  )}
                </section>

                {detail.recentAdminActions && detail.recentAdminActions.length > 0 && (
                  <section className="rounded-lg border border-neutral-200 p-4 dark:border-dark-700">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Recent administrator actions</h3>
                    <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                      {detail.recentAdminActions.map((row) => (
                        <li key={row.id}>
                          <span className="font-mono">{row.action}</span> · {row.adminEmail} ·{' '}
                          {new Date(row.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
