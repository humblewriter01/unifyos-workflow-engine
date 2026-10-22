import { useCallback, useEffect, useState } from 'react';
import { Loader2, MailCheck, Send, Users } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';

type Audience = 'ALL' | 'FREE' | 'PRO' | 'BUSINESS';

const AUDIENCE_LABELS: Record<Audience, string> = {
  ALL: 'All users',
  FREE: 'Free plan',
  PRO: 'Pro plan',
  BUSINESS: 'Business plan',
};

export default function AdminEmailBlastPage() {
  const [audiences, setAudiences] = useState<Array<{ audience: Audience; recipients: number }>>([]);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<{ plan: Audience; subject: string; body: string }>({
    plan: 'ALL',
    subject: '',
    body: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/email-blast');
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load the audience.');
      setAudiences(body.data.audiences);
      setEmailConfigured(body.data.emailConfigured);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the audience.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recipientCount = audiences.find((row) => row.audience === form.plan)?.recipients ?? 0;

  async function send(dryRun: boolean) {
    if (!dryRun) {
      const confirmed = window.confirm(
        `Send "${form.subject}" to ${recipientCount} ${AUDIENCE_LABELS[form.plan].toLowerCase()}? This cannot be undone.`,
      );
      if (!confirmed) return;
    }
    setSending(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/email-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dryRun }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error?.message || 'The email blast could not be sent.');
        return;
      }
      setNotice(
        dryRun
          ? body.message || 'Test message sent.'
          : `${body.message || 'Blast sent.'}${body.data?.failed ? ` ${body.data.failed} failed.` : ''}`,
      );
    } catch {
      setNotice('The email blast could not be sent.');
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900 dark:text-white';

  return (
    <AdminShell
      title="Email blast"
      description="Send a custom message to every account on a plan. Each message is delivered through the same Resend transport as transactional mail."
    >
      <div className="space-y-6">
        {!emailConfigured && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
            <code className="font-mono">RESEND_API_KEY</code> is not configured, so no email can be delivered.
          </p>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(false);
          }}
          className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800"
        >
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Audience</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(['ALL', 'FREE', 'PRO', 'BUSINESS'] as Audience[]).map((audience) => {
                const count = audiences.find((row) => row.audience === audience)?.recipients;
                return (
                  <button
                    key={audience}
                    type="button"
                    onClick={() => setForm({ ...form, plan: audience })}
                    aria-pressed={form.plan === audience}
                    className={`flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-left text-sm ${
                      form.plan === audience
                        ? 'border-primary-500 bg-primary-50 text-primary-900 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-200'
                        : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-900/60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" /> {AUDIENCE_LABELS[audience]}
                    </span>
                    <span className="text-xs opacity-80">
                      {loading ? 'counting…' : `${count ?? 0} recipient${(count ?? 0) === 1 ? '' : 's'}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" htmlFor="blast-subject">
              Subject
            </label>
            <input
              id="blast-subject"
              required
              maxLength={200}
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              placeholder="New: scheduled workflows and retry policies"
              className={`${inputClass} mt-1`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" htmlFor="blast-body">
              Message ({form.body.length}/10000)
            </label>
            <textarea
              id="blast-body"
              required
              rows={10}
              maxLength={10_000}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder={'Hi there,\n\nHere is what is new this month…\n\n— The UnifyOS team'}
              className={`${inputClass} mt-1`}
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Blank lines start a new paragraph. Plain text only — no HTML is rendered.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void send(true)}
              disabled={sending || !form.subject.trim() || !form.body.trim()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-dark-600 dark:text-neutral-200 dark:hover:bg-dark-900/60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MailCheck className="h-4 w-4" aria-hidden="true" />}
              Send test to myself
            </button>
            <button
              type="submit"
              disabled={sending || !emailConfigured}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Send to {recipientCount} {AUDIENCE_LABELS[form.plan].toLowerCase()}
            </button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Sends are capped at 500 recipients per batch and logged in the audit trail with the recipient count.
          </p>
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
      </div>
    </AdminShell>
  );
}
