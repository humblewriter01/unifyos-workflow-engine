import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

type User = { id: string; email: string; plan: string; adminRole: string; emailVerified: boolean; twoFactorEnabled: boolean };
type Metrics = { users: number; workflows: number; connectedApps: number; plans: number; activeSubscriptions: number; successfulPayments: number };

export default function AdminControlPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.adminRole;
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const overviewResponse = await fetch('/api/admin/overview');
    const overview = await overviewResponse.json();
    if (overviewResponse.ok) { setMetrics(overview.data.metrics); setAudit(overview.data.audit || []); } else setMessage(overview.error?.message || 'Admin overview unavailable.');
    const usersResponse = await fetch('/api/admin/users');
    const usersBody = await usersResponse.json();
    if (usersResponse.ok) setUsers(usersBody.data); else setMessage(usersBody.error?.message || 'User administration unavailable.');
  }
  useEffect(() => { if (status === 'authenticated' && role === 'SUPER_ADMIN') void load(); }, [status, role]);
  async function updateUser(user: User, patch: Record<string, unknown>) {
    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const body = await response.json();
    setMessage(response.ok ? `Updated ${user.email}.` : body.error?.message || 'Unable to update user.');
    if (response.ok) await load();
  }

  return <DashboardLayout><main className="max-w-7xl mx-auto space-y-6"><div><h1 className="text-2xl font-bold">Admin control center</h1><p className="mt-1 text-neutral-600">Overall platform activity, access control, and audit visibility.</p></div>{message && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}{!role || role === 'NONE' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">Administrator permissions are not assigned.</div> : role !== 'SUPER_ADMIN' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">Full control requires SUPER_ADMIN. Current role: {role}.</div> : <><div className="rounded-xl border border-amber-300 bg-amber-50 p-5"><strong>MFA required:</strong> enable authenticator MFA in Security Settings before privileged API requests are accepted.</div>{metrics && <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">{Object.entries(metrics).map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-4"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-neutral-500">{key.replace(/[A-Z]/g, (m) => ` ${m}`).toLowerCase()}</div></div>)}</div>}<section className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Users and roles</h2><div className="space-y-3">{users.map((user) => <div key={user.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><div className="font-medium">{user.email}</div><div className="text-xs text-neutral-500">{user.emailVerified ? 'verified' : 'unverified'} · {user.twoFactorEnabled ? 'MFA enabled' : 'MFA required'} · plan {user.plan}</div></div><div className="flex gap-2"><select value={user.adminRole} onChange={(e) => void updateUser(user, { adminRole: e.target.value })} className="rounded border px-2 py-1 text-sm"><option>NONE</option><option>SUPPORT_READONLY</option><option>BILLING_ADMIN</option><option>CATALOG_ADMIN</option><option>SUPER_ADMIN</option></select><select value={user.plan} onChange={(e) => void updateUser(user, { plan: e.target.value })} className="rounded border px-2 py-1 text-sm"><option>FREE</option><option>PRO</option><option>BUSINESS</option></select></div></div>)}</div></section><section className="rounded-xl border bg-white p-6"><h2 className="mb-3 text-lg font-semibold">Recent audit activity</h2>{audit.map((entry) => <div key={entry.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{entry.action}</span><time className="text-xs text-neutral-500">{new Date(entry.createdAt).toLocaleString()}</time></div>)}</section></>}</main></DashboardLayout>;
}
