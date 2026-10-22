import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import StatusPill, { toneForStatus } from '../../components/admin/StatusPill';

interface PlanPrice {
  id: string;
  version: number;
  amount: number;
  currency: string;
  interval: string;
}

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  prices: PlanPrice[];
}

const money = (currency: string, minor: number) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '', amount: '', currency: 'NGN', interval: 'MONTH' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/plans');
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load the catalog.');
      setPlans(body.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The plan could not be created.');
        return;
      }
      setNotice(`Draft plan “${body.data.name}” created.`);
      setForm({ key: '', name: '', description: '', amount: '', currency: 'NGN', interval: 'MONTH' });
      await load();
    } catch {
      setNotice('The plan could not be created.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Plan catalog" description="Draft price plans and their published prices. Plans stay in DRAFT until approved.">
      <div className="space-y-6">
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

        <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Create draft plan</h2>
          <form onSubmit={createPlan} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Internal key
              <input
                required
                pattern="[a-z0-9][a-z0-9_-]{1,63}"
                value={form.key}
                onChange={(event) => setForm({ ...form, key: event.target.value })}
                placeholder="pro-monthly"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Display name
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Description
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Amount (minor units)
              <input
                required
                type="number"
                min={0}
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Currency
              <select
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
              >
                <option>NGN</option>
                <option>GHS</option>
                <option>ZAR</option>
                <option>USD</option>
              </select>
            </label>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Interval
              <select
                value={form.interval}
                onChange={(event) => setForm({ ...form, interval: event.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white"
              >
                <option>MONTH</option>
                <option>YEAR</option>
                <option>ONE_TIME</option>
              </select>
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create draft
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Catalog</h2>
          {loading && <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading catalog…</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-neutral-900 dark:text-white">{plan.name}</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      key: {plan.key} · {plan.description || 'No description'}
                    </p>
                  </div>
                  <StatusPill tone={toneForStatus(plan.status)}>{plan.status}</StatusPill>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {plan.prices.map((price) => (
                    <li key={price.id}>
                      v{price.version}: {money(price.currency, price.amount)} / {price.interval.toLowerCase()}
                    </li>
                  ))}
                  {plan.prices.length === 0 && <li>No prices</li>}
                </ul>
              </article>
            ))}
            {!loading && plans.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No plans yet.</p>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
