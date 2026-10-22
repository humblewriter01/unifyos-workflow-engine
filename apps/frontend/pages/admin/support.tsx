import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Inbox, Loader2, Mail, RefreshCw } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import StatusPill from '../../components/admin/StatusPill';

interface Ticket {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  status: 'open' | 'resolved';
  userId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

type Filter = 'open' | 'resolved' | 'all';

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<{ open: number; resolved: number }>({ open: 0, resolved: 0 });
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async (next: Filter) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/support-tickets?status=${next}&limit=50`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load the support inbox.');
      setTickets(body.data);
      setCounts(body.meta?.counts ?? { open: 0, resolved: 0 });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the support inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function resolve(ticket: Ticket) {
    setPendingId(ticket.id);
    setNotice('');
    try {
      const response = await fetch(`/api/admin/support-tickets/${encodeURIComponent(ticket.id)}/resolve`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The ticket could not be updated.');
        return;
      }
      setTickets((previous) =>
        filter === 'open'
          ? previous.filter((row) => row.id !== ticket.id)
          : previous.map((row) => (row.id === ticket.id ? { ...row, ...body.data } : row)),
      );
      setCounts((previous) => ({ open: Math.max(0, previous.open - 1), resolved: previous.resolved + 1 }));
      setNotice(`Ticket from ${ticket.email} marked resolved.`);
    } catch {
      setNotice('The ticket could not be updated.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AdminShell
      title="Support inbox"
      description="Every message submitted through the contact form is stored here first, then emailed. Nothing is lost if email delivery fails."
      actions={
        <button
          type="button"
          onClick={() => void load(filter)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['open', 'resolved', 'all'] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              aria-pressed={filter === option}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-sm font-medium capitalize ${
                filter === option
                  ? 'bg-primary-600 text-white'
                  : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-800'
              }`}
            >
              {option}
              <span className="rounded-full bg-black/10 px-1.5 text-xs">
                {option === 'open' ? counts.open : option === 'resolved' ? counts.resolved : counts.open + counts.resolved}
              </span>
            </button>
          ))}
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

        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-dark-700 dark:bg-dark-800 dark:text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading tickets…
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-10 text-center dark:border-dark-700 dark:bg-dark-800">
            <Inbox className="h-6 w-6 text-neutral-400" aria-hidden="true" />
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {filter === 'open' ? 'No open tickets. The inbox is clear.' : 'No tickets in this view yet.'}
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const expanded = openId === ticket.id;
            return (
              <li key={ticket.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-dark-700 dark:bg-dark-800">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-neutral-900 dark:text-white">{ticket.subject}</p>
                      <StatusPill tone={ticket.status === 'resolved' ? 'success' : 'warning'}>{ticket.status}</StatusPill>
                      <StatusPill tone="neutral">{ticket.category}</StatusPill>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      {ticket.name} ·{' '}
                      <a href={`mailto:${ticket.email}`} className="text-primary-600 underline dark:text-primary-400">
                        {ticket.email}
                      </a>{' '}
                      · {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                    {ticket.resolvedAt && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Resolved {new Date(ticket.resolvedAt).toLocaleString()} by {ticket.resolvedBy ?? 'unknown'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(expanded ? null : ticket.id)}
                      aria-expanded={expanded}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-900/60"
                    >
                      {expanded ? 'Hide' : 'View'}
                      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    <a
                      href={`mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject}`)}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-900/60"
                    >
                      <Mail className="h-4 w-4" aria-hidden="true" /> Reply
                    </a>
                    {ticket.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => void resolve(ticket)}
                        disabled={pendingId === ticket.id}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {pendingId === ticket.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        )}
                        Resolved
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-neutral-200 bg-neutral-50 p-5 dark:border-dark-700 dark:bg-dark-900/40">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">{ticket.message}</p>
                    <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                      Ticket id <code className="rounded bg-neutral-200 px-1 dark:bg-dark-700">{ticket.id}</code>
                      {ticket.userId ? ` · account ${ticket.userId}` : ' · submitted signed out'}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </AdminShell>
  );
}
