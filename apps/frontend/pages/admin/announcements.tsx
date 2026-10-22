import { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone, XCircle } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import StatusPill from '../../components/admin/StatusPill';

interface Announcement {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'critical';
  publishedAt: string;
  publishedBy: string;
  expiresAt: string | null;
}

const TONES: Array<{ value: Announcement['tone']; label: string; swatch: string }> = [
  { value: 'info', label: 'Info (blue)', swatch: 'bg-blue-500' },
  { value: 'success', label: 'Success (green)', swatch: 'bg-emerald-500' },
  { value: 'warning', label: 'Warning (amber)', swatch: 'bg-amber-500' },
  { value: 'critical', label: 'Critical (red)', swatch: 'bg-red-500' },
];

export default function AdminAnnouncementsPage() {
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; adminEmail: string; createdAt: string; metadata: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ message: '', tone: 'info', expiresAt: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/announcements');
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load announcements.');
      setCurrent(body.data.current);
      setHistory(body.data.history ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: form.message, tone: form.tone, expiresAt: form.expiresAt || null }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The announcement could not be published.');
        return;
      }
      setCurrent(body.data);
      setNotice('Announcement published. It is now visible on every dashboard page.');
      setForm({ message: '', tone: form.tone, expiresAt: '' });
      void load();
    } catch {
      setNotice('The announcement could not be published.');
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!window.confirm('Remove the banner for every user?')) return;
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/announcements', { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The announcement could not be cleared.');
        return;
      }
      setCurrent(null);
      setNotice('Banner cleared.');
      void load();
    } catch {
      setNotice('The announcement could not be cleared.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white';

  return (
    <AdminShell
      title="Announcements"
      description="A dismissible banner at the top of every dashboard page. Users dismiss it per announcement, so a new message reappears."
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Live banner</h2>
          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
            </div>
          ) : current ? (
            <div className="mt-3 space-y-3">
              <div role="status" className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900 dark:border-primary-800/60 dark:bg-primary-900/20 dark:text-primary-200">
                {current.message}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <StatusPill tone="success">{current.tone}</StatusPill>
                <span>Published {new Date(current.publishedAt).toLocaleString()}</span>
                <span>by {current.publishedBy}</span>
                <span>{current.expiresAt ? `Expires ${new Date(current.expiresAt).toLocaleString()}` : 'No expiry'}</span>
              </div>
              <button
                type="button"
                onClick={() => void clear()}
                disabled={saving}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" /> Clear banner
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">No banner is currently shown.</p>
          )}
        </section>

        <form onSubmit={publish} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
            <Megaphone className="h-4 w-4" aria-hidden="true" /> Publish a new banner
          </h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" htmlFor="announcement-message">
              Message ({form.message.length}/280)
            </label>
            <textarea
              id="announcement-message"
              required
              maxLength={280}
              rows={3}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              placeholder="Scheduled maintenance on Saturday 22:00–23:00 UTC. Workflows will pause briefly."
              className={`${inputClass} mt-1`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" htmlFor="announcement-tone">
                Style
              </label>
              <select
                id="announcement-tone"
                value={form.tone}
                onChange={(event) => setForm({ ...form, tone: event.target.value })}
                className={`${inputClass} mt-1`}
              >
                {TONES.map((tone) => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" htmlFor="announcement-expiry">
                Auto-hide after (optional)
              </label>
              <input
                id="announcement-expiry"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !form.message.trim()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Megaphone className="h-4 w-4" aria-hidden="true" />}
            Publish
          </button>
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

        <section className="rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
          <h2 className="border-b border-neutral-200 px-5 py-4 text-base font-semibold text-neutral-900 dark:border-dark-700 dark:text-white">
            Recent publications
          </h2>
          <ul className="divide-y divide-neutral-200 dark:divide-dark-700">
            {history.map((row) => {
              const active = row.metadata.active === true;
              return (
                <li key={row.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={active ? 'success' : 'neutral'}>{active ? 'published' : 'cleared'}</StatusPill>
                    <span className="text-neutral-500 dark:text-neutral-400">{new Date(row.createdAt).toLocaleString()}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">by {row.adminEmail}</span>
                  </div>
                  {active && typeof row.metadata.message === 'string' && (
                    <p className="text-neutral-700 dark:text-neutral-200">{row.metadata.message}</p>
                  )}
                </li>
              );
            })}
            {history.length === 0 && (
              <li className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">Nothing published yet.</li>
            )}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
