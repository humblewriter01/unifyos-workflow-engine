import { FormEvent, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

type Plan = { id: string; key: string; name: string; description?: string | null; status: string; prices: Array<{ amount: number; currency: string; interval: string; version: number }> };

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ key: '', name: '', description: '', amount: '', currency: 'NGN', interval: 'MONTH' });
  const role = session?.user?.adminRole;

  async function load() {
    const response = await fetch('/api/admin/plans');
    const body = await response.json();
    if (response.ok) setPlans(body.data); else setMessage(body.error?.message || 'Administrator access is unavailable.');
  }
  useEffect(() => { if (status === 'authenticated') void load(); }, [status]);

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    const body = await response.json();
    setMessage(response.ok ? 'Draft plan created and recorded in the audit log.' : body.error?.message || 'Unable to create plan.');
    if (response.ok) { setForm({ key: '', name: '', description: '', amount: '', currency: 'NGN', interval: 'MONTH' }); await load(); }
  }

  return <DashboardLayout><div className="max-w-6xl mx-auto space-y-6"><div><h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Administration</h1><p className="mt-1 text-neutral-600 dark:text-neutral-400">Catalog changes are server-authorized, MFA-gated, versioned, and start as drafts.</p></div>{message && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}{!role || role === 'NONE' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">You do not have administrator permissions. Privileged access cannot be granted from this page.</div> : <><form onSubmit={createPlan} className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-dark-700 dark:bg-dark-800 md:grid-cols-2"><h2 className="md:col-span-2 text-lg font-semibold text-neutral-900 dark:text-white">Create draft plan</h2>{[['key','Internal key'],['name','Display name'],['description','Description'],['amount','Amount in minor units']].map(([key,label]) => <label key={key} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}<input required={key !== 'description'} type={key === 'amount' ? 'number' : 'text'} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-dark-600 dark:bg-dark-700 dark:text-white" /></label>)}<label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Currency<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-dark-600 dark:bg-dark-700 dark:text-white"><option>NGN</option><option>GHS</option><option>ZAR</option><option>USD</option></select></label><label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Interval<select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-dark-700 dark:bg-dark-700 dark:text-white"><option>MONTH</option><option>YEAR</option><option>ONE_TIME</option></select></label><button className="md:col-span-2 w-fit rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">Create draft</button></form><section className="space-y-3"><h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Catalog</h2>{plans.map((plan) => <article key={plan.id} className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-dark-700 dark:bg-dark-800"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-neutral-900 dark:text-white">{plan.name} <span className="text-xs text-neutral-500">({plan.key})</span></h3><p className="text-sm text-neutral-600 dark:text-neutral-400">{plan.description || 'No description'}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{plan.status}</span></div>{plan.prices.map((price) => <p key={price.version} className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">Version {price.version}: {new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.amount / 100)} / {price.interval.toLowerCase()}</p>)}</article>)}</section></>}</div></DashboardLayout>;
}
