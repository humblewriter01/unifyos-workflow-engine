import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
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

const ROLES = ['NONE', 'SUPPORT_READONLY', 'BILLING_ADMIN', 'CATALOG_ADMIN', 'SUPER_ADMIN'];
const PLANS = ['FREE', 'PRO', 'BUSINESS'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  async function patchUser(user: AdminUser, patch: { adminRole?: string; plan?: string }) {
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
      setNotice(`Updated ${user.email}.`);
    } catch {
      setNotice('The user could not be updated.');
    } finally {
      setPendingId(null);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => user.email.toLowerCase().includes(needle) || (user.name ?? '').toLowerCase().includes(needle));
  }, [query, users]);

  return (
    <AdminShell
      title="Users"
      description="Accounts, plans and administrator roles. Role changes are audited with your email address."
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
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-dark-900 dark:text-neutral-400">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">User</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Plan</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Admin role</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Last login</th>
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
                        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
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
                        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
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
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-neutral-500 dark:text-neutral-400">
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
    </AdminShell>
  );
}
