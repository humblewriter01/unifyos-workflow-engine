import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../components/layout/DashboardLayout';

type Plan = { id: string; key: string; name: string; description?: string | null; prices: Array<{ id: string; amount: number; currency: string; interval: string; trialDays: number }> };
type BillingSummary = { subscription: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd?: string | null; plan?: { name: string } | null } | null; payments: Array<{ reference: string; amount: number; currency: string; status: string; createdAt: string }> };

export default function BillingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    Promise.all([fetch('/api/billing/plans').then((r) => r.json()), fetch('/api/billing/me').then((r) => r.json())]).then(([body, account]) => {
      if (body.success) {
        setPlans(body.data);
        setSelected(body.data?.[0]?.prices?.[0]?.id || '');
      } else setMessage(body.error?.message || 'Plans are unavailable.');
      if (account.success) setSummary(account.data);
    }).catch(() => setMessage('Plans are temporarily unavailable.')).finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    const reference = typeof router.query.reference === 'string' ? router.query.reference : '';
    if (!reference || status !== 'authenticated') return;
    fetch(`/api/billing/verify?reference=${encodeURIComponent(reference)}`).then(async (r) => {
      const body = await r.json();
      setMessage(body.success ? 'Payment verified. Your plan is being updated.' : body.error?.message || 'Payment is still pending verification.');
    }).catch(() => setMessage('Payment verification is temporarily unavailable.'));
  }, [router.query.reference, status]);

  async function beginCheckout() {
    if (!selected) return;
    setMessage('Creating secure checkout…');
    const response = await fetch('/api/billing/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: selected }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error?.message || 'Unable to start checkout.');
    window.location.assign(body.data.authorizationUrl);
  }

  return <DashboardLayout><div className="max-w-5xl mx-auto space-y-6"><div><h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Billing</h1><p className="text-neutral-600 dark:text-neutral-400 mt-1">Choose a plan. Payment is confirmed by the server before access changes.</p></div>{message && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}{loading ? <div className="text-neutral-500">Loading plans…</div> : <div className="grid gap-5 md:grid-cols-2">{plans.map((plan) => plan.prices.map((price) => <article key={price.id} className={`rounded-xl border p-6 ${selected === price.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-neutral-200 dark:border-dark-700'} bg-white dark:bg-dark-800`}><h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{plan.name}</h2><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{plan.description || 'Workflow automation features for your team.'}</p><div className="mt-5 text-3xl font-bold text-neutral-900 dark:text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.amount / 100)}<span className="text-sm font-normal text-neutral-500">/{price.interval.toLowerCase()}</span></div><button onClick={() => setSelected(price.id)} className="mt-5 w-full rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">{selected === price.id ? 'Selected' : 'Choose plan'}</button></article>))}</div>}{summary?.subscription && <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800"><h2 className="font-semibold text-neutral-900 dark:text-white">Current subscription</h2><p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{summary.subscription.plan?.name || 'Plan'} · {summary.subscription.status}{summary.subscription.cancelAtPeriodEnd ? ' · cancels at period end' : ''}</p></section>}{summary && summary.payments.length > 0 && <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800"><h2 className="font-semibold text-neutral-900 dark:text-white">Payment history</h2><div className="mt-3 divide-y divide-neutral-200 dark:divide-dark-700">{summary.payments.map((payment) => <div key={payment.reference} className="flex items-center justify-between py-3 text-sm"><span className="text-neutral-600 dark:text-neutral-400">{new Date(payment.createdAt).toLocaleDateString()} · {payment.reference.slice(0, 14)}…</span><span className="font-medium text-neutral-900 dark:text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: payment.currency }).format(payment.amount / 100)} · {payment.status}</span></div>)}</div></section>}{!loading && plans.length > 0 && <button onClick={beginCheckout} disabled={!selected} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Continue to secure checkout</button>}</div></DashboardLayout>;
}
