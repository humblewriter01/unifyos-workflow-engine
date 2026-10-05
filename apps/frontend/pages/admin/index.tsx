import { FormEvent, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import BackButton from '../../components/BackButton';

type User = { id: string; email: string; plan: string; adminRole: string; emailVerified: boolean; twoFactorEnabled: boolean };
type Plan = { id: string; key: string; name: string; description?: string | null; status: string; prices: Array<{ amount: number; currency: string; interval: string; version: number }> };
type Metrics = { users: number; workflows: number; connectedApps: number; plans: number; activeSubscriptions: number; successfulPayments: number };

export default function AdminPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.adminRole;
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ key: '', name: '', description: '', amount: '', currency: 'NGN', interval: 'MONTH' });

  async function load() {
    const [overviewResponse, usersResponse, plansResponse] = await Promise.all([fetch('/api/admin/overview'), fetch('/api/admin/users'), fetch('/api/admin/plans')]);
    const overview = await overviewResponse.json(); const usersBody = await usersResponse.json(); const plansBody = await plansResponse.json();
    if (overviewResponse.ok) { setMetrics(overview.data.metrics); setAudit(overview.data.audit || []); }
    if (usersResponse.ok) setUsers(usersBody.data);
    if (plansResponse.ok) setPlans(plansBody.data);
    if (!overviewResponse.ok || !usersResponse.ok || !plansResponse.ok) setMessage(overview.error?.message || usersBody.error?.message || plansBody.error?.message || 'Administrator access is unavailable.');
  }
  useEffect(() => { if (status === 'authenticated' && role === 'SUPER_ADMIN') void load(); }, [status, role]);
  async function createPlan(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    const body = await response.json(); setMessage(response.ok ? 'Draft plan created and audited.' : body.error?.message || 'Unable to create plan.');
    if (response.ok) { setForm({ key: '', name: '', description: '', amount: '', currency: 'NGN', interval: 'MONTH' }); await load(); }
  }
  async function updateUser(user: User, patch: Record<string, unknown>) {
    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const body = await response.json(); setMessage(response.ok ? `Updated ${user.email}.` : body.error?.message || 'Unable to update user.'); if (response.ok) await load();
  }

  return <DashboardLayout><main className="mx-auto max-w-7xl space-y-6"><BackButton /><header><h1 className="text-2xl font-bold">Administration</h1><p className="mt-1 text-neutral-600">Direct admin access at <code>/admin</code>: pricing, users, platform activity, and audit controls.</p></header>{message && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}{!role || role === 'NONE' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">Administrator permissions are not assigned.</div> : role !== 'SUPER_ADMIN' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">Full control requires SUPER_ADMIN. Current role: {role}.</div> : <><div className="rounded-xl border border-amber-300 bg-amber-50 p-5"><strong>MFA required:</strong> enable authenticator MFA in Security Settings before privileged API requests are accepted.</div>{metrics && <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">{Object.entries(metrics).map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-4"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-neutral-500">{key.replace(/[A-Z]/g, (m) => ` ${m}`).toLowerCase()}</div></div>)}</div>}<section className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Create draft price plan</h2><form onSubmit={createPlan} className="grid gap-4 md:grid-cols-3">{[['key','Internal key'],['name','Display name'],['description','Description'],['amount','Amount in minor units']].map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input required={key !== 'description'} type={key === 'amount' ? 'number' : 'text'} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>)}<label className="text-sm font-medium">Currency<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option>NGN</option><option>GHS</option><option>ZAR</option><option>USD</option></select></label><label className="text-sm font-medium">Interval<select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option>MONTH</option><option>YEAR</option><option>ONE_TIME</option></select></label><button className="rounded bg-blue-600 px-5 py-2.5 font-semibold text-white">Create draft</button></form></section><section><h2 className="mb-3 text-lg font-semibold">Catalog</h2><div className="grid gap-3 md:grid-cols-2">{plans.map((plan) => <article key={plan.id} className="rounded-xl border bg-white p-5"><div className="flex justify-between"><div><h3 className="font-semibold">{plan.name} <span className="text-xs text-neutral-500">({plan.key})</span></h3><p className="text-sm text-neutral-600">{plan.description || 'No description'}</p></div><span className="text-xs font-semibold">{plan.status}</span></div>{plan.prices.map((price) => <p key={price.version} className="mt-3 text-sm">Version {price.version}: {new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.amount / 100)} / {price.interval.toLowerCase()}</p>)}</article>)}</div></section><section className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Users and roles</h2><div className="space-y-3">{users.map((user) => <div key={user.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><div className="font-medium">{user.email}</div><div className="text-xs text-neutral-500">{user.emailVerified ? 'verified' : 'unverified'} · {user.twoFactorEnabled ? 'MFA enabled' : 'MFA required'} · plan {user.plan}</div></div><div className="flex gap-2"><select value={user.adminRole} onChange={(e) => void updateUser(user, { adminRole: e.target.value })} className="rounded border px-2 py-1 text-sm"><option>NONE</option><option>SUPPORT_READONLY</option><option>BILLING_ADMIN</option><option>CATALOG_ADMIN</option><option>SUPER_ADMIN</option></select><select value={user.plan} onChange={(e) => void updateUser(user, { plan: e.target.value })} className="rounded border px-2 py-1 text-sm"><option>FREE</option><option>PRO</option><option>BUSINESS</option></select></div></div>)}</div></section><section className="rounded-xl border bg-white p-6"><h2 className="mb-3 text-lg font-semibold">Recent audit activity</h2>{audit.map((entry) => <div key={entry.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{entry.action}</span><time className="text-xs text-neutral-500">{new Date(entry.createdAt).toLocaleString()}</time></div>)}</section></>}</main></DashboardLayout>;
}
