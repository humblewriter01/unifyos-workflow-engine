import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Tag, Trash2 } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import StatusPill from '../../components/admin/StatusPill';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  currency: string;
  maxUses: number | null;
  maxUsesPerUser: number;
  usedCount: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** Minor units → the major unit string the operator typed. */
function formatDiscount(promo: PromoCode): string {
  if (promo.discountType === 'PERCENTAGE') return `${promo.discountValue}% off`;
  return `${promo.currency} ${(promo.discountValue / 100).toFixed(2)} off`;
}

function statusOf(promo: PromoCode): { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string } {
  if (!promo.active) return { tone: 'neutral', label: 'disabled' };
  if (promo.expiresAt && new Date(promo.expiresAt) <= new Date()) return { tone: 'danger', label: 'expired' };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { tone: 'warning', label: 'exhausted' };
  return { tone: 'success', label: 'active' };
}

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '10',
    maxUses: '',
    maxUsesPerUser: '1',
    currency: 'NGN',
    expiresAt: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/promo-codes');
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load promo codes.');
      setCodes(body.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load promo codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      // FLAT discounts are entered in major units and stored as minor units.
      const rawValue = Number(form.discountValue);
      const discountValue = form.discountType === 'FLAT' ? Math.round(rawValue * 100) : Math.round(rawValue);

      const response = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          discountValue,
          maxUses: form.maxUses === '' ? null : Number(form.maxUses),
          maxUsesPerUser: Number(form.maxUsesPerUser),
          currency: form.currency,
          expiresAt: form.expiresAt || null,
          description: form.description || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The promo code could not be created.');
        return;
      }
      setCodes((previous) => [body.data, ...previous]);
      setNotice(body.message || 'Promo code created.');
      setForm((previous) => ({ ...previous, code: '', description: '', expiresAt: '' }));
    } catch {
      setNotice('The promo code could not be created.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(promo: PromoCode) {
    setPendingId(promo.id);
    setNotice('');
    try {
      const response = await fetch(`/api/admin/promo-codes/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !promo.active }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The promo code could not be updated.');
        return;
      }
      setCodes((previous) => previous.map((row) => (row.id === promo.id ? body.data : row)));
    } catch {
      setNotice('The promo code could not be updated.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(promo: PromoCode) {
    if (!window.confirm(`Delete ${promo.code}? Codes that have been redeemed are deactivated instead.`)) return;
    setPendingId(promo.id);
    setNotice('');
    try {
      const response = await fetch(`/api/admin/promo-codes/${promo.id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The promo code could not be removed.');
        return;
      }
      if (body.data?.active === false && body.data?.code) {
        setCodes((previous) => previous.map((row) => (row.id === promo.id ? body.data : row)));
      } else {
        setCodes((previous) => previous.filter((row) => row.id !== promo.id));
      }
      setNotice(body.message || 'Promo code removed.');
    } catch {
      setNotice('The promo code could not be removed.');
    } finally {
      setPendingId(null);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400';

  return (
    <AdminShell
      title="Promo codes"
      description="Codes are validated again at checkout, and a redemption is only counted after Paystack confirms the payment."
    >
      <div className="space-y-6">
        <form onSubmit={create} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
            <Plus className="h-4 w-4" aria-hidden="true" /> Create a code
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelClass} htmlFor="promo-code">
                Code
              </label>
              <input
                id="promo-code"
                required
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="LAUNCH20"
                className={`${inputClass} mt-1 font-mono`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="promo-type">
                Type
              </label>
              <select
                id="promo-type"
                value={form.discountType}
                onChange={(event) => setForm({ ...form, discountType: event.target.value })}
                className={`${inputClass} mt-1`}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FLAT">Flat amount</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="promo-value">
                {form.discountType === 'PERCENTAGE' ? 'Percent off' : 'Amount off (major units)'}
              </label>
              <input
                id="promo-value"
                required
                type="number"
                min="1"
                max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                step={form.discountType === 'PERCENTAGE' ? 1 : 0.01}
                value={form.discountValue}
                onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="promo-currency">
                Currency
              </label>
              <input
                id="promo-currency"
                value={form.currency}
                maxLength={3}
                onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
                className={`${inputClass} mt-1`}
                disabled={form.discountType === 'PERCENTAGE'}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="promo-max">
                Max uses (empty = unlimited)
              </label>
              <input
                id="promo-max"
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(event) => setForm({ ...form, maxUses: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="promo-per-user">
                Uses per user (0 = unlimited)
              </label>
              <input
                id="promo-per-user"
                type="number"
                min="0"
                max="100"
                value={form.maxUsesPerUser}
                onChange={(event) => setForm({ ...form, maxUsesPerUser: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="promo-expiry">
                Expires
              </label>
              <input
                id="promo-expiry"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="promo-description">
                Note (internal)
              </label>
              <input
                id="promo-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Launch campaign"
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              A discount can never make an order free — Paystack cannot charge zero. The maximum discount leaves one minor unit payable.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Tag className="h-4 w-4" aria-hidden="true" />}
              Create code
            </button>
          </div>
        </form>

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
                  <th scope="col" className="px-5 py-3 font-semibold">Code</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Discount</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Usage</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Expires</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-700">
                {codes.map((promo) => {
                  const status = statusOf(promo);
                  return (
                    <tr key={promo.id} className="hover:bg-neutral-50 dark:hover:bg-dark-900/60">
                      <td className="px-5 py-3">
                        <p className="font-mono font-semibold text-neutral-900 dark:text-white">{promo.code}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{promo.description || '—'}</p>
                      </td>
                      <td className="px-5 py-3 text-neutral-700 dark:text-neutral-200">{formatDiscount(promo)}</td>
                      <td className="px-5 py-3 text-neutral-700 dark:text-neutral-200">
                        {promo.usedCount}
                        {promo.maxUses !== null ? ` / ${promo.maxUses}` : ' / ∞'}
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                          {promo.maxUsesPerUser === 0 ? 'unlimited per user' : `${promo.maxUsesPerUser} per user`}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-neutral-700 dark:text-neutral-200">
                        {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString() : 'never'}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void toggle(promo)}
                            disabled={pendingId === promo.id}
                            className="inline-flex min-h-[34px] items-center rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-900/60"
                          >
                            {promo.active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(promo)}
                            disabled={pendingId === promo.id}
                            aria-label={`Delete ${promo.code}`}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
                    </td>
                  </tr>
                )}
                {!loading && codes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      No promo codes yet. Create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
