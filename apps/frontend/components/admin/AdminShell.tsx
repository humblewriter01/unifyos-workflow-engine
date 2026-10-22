import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';

/**
 * Admin shell: access probe + secondary navigation.
 *
 * The probe exists to turn the three distinct authorisation failures into
 * actionable screens instead of an empty table:
 *   401 AUTH_REQUIRED        → session expired
 *   403 ADMIN_MFA_REQUIRED   → TOTP must be enabled on the admin account
 *   403 ADMIN_FORBIDDEN      → not an administrator
 *
 * It is a UX layer only. Every API route independently calls `requireAdmin()`.
 */

type Access = 'checking' | 'ok' | 'auth' | 'mfa' | 'forbidden' | 'error';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/health', label: 'Integration health' },
  { href: '/admin/workflows', label: 'Workflows' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/audit', label: 'Audit log' },
];

interface AdminShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminShell({ title, description, actions, children }: AdminShellProps) {
  const router = useRouter();
  const [access, setAccess] = useState<Access>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/overview')
      .then(async (response) => {
        if (cancelled) return;
        if (response.ok) return setAccess('ok');
        const body = await response.json().catch(() => null);
        const code = body?.error?.code;
        setMessage(body?.error?.message || '');
        if (response.status === 401) return setAccess('auth');
        if (code === 'ADMIN_MFA_REQUIRED') return setAccess('mfa');
        if (response.status === 403) return setAccess('forbidden');
        return setAccess('error');
      })
      .catch(() => !cancelled && setAccess('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (href: string) => (href === '/admin' ? router.pathname === '/admin' : router.pathname.startsWith(href));

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              <h1 className="truncate text-2xl font-bold text-neutral-900 dark:text-white">{title}</h1>
            </div>
            {description && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </header>

        <nav aria-label="Admin sections" className="-mx-1 overflow-x-auto">
          <ul className="flex min-w-max gap-1 px-1">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={isActive(tab.href) ? 'page' : undefined}
                  className={`inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                    isActive(tab.href)
                      ? 'bg-primary-600 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-dark-800'
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {access === 'checking' && (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-dark-700 dark:bg-dark-800 dark:text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking administrator access…
          </div>
        )}

        {access === 'auth' && (
          <Notice tone="warning" title="Sign in required">
            Your session has expired.{' '}
            <Link href="/auth/login?callbackUrl=/admin" className="font-semibold underline">
              Sign in again
            </Link>{' '}
            to continue.
          </Notice>
        )}

        {access === 'mfa' && (
          <Notice tone="warning" title="Two-factor authentication is required">
            Administrator requests are only accepted from accounts with an authenticator app enabled. Turn it on in{' '}
            <Link href="/settings/security" className="font-semibold underline">
              Security settings
            </Link>
            , then reload this page.
          </Notice>
        )}

        {access === 'forbidden' && (
          <Notice tone="danger" title="Administrator access required">
            {message || 'Your account does not have an administrator role.'}
          </Notice>
        )}

        {access === 'error' && (
          <Notice tone="danger" title="Admin data unavailable">
            {message || 'The administration service is temporarily unavailable. Try again shortly.'}
          </Notice>
        )}

        {access === 'ok' && children}
      </main>
    </DashboardLayout>
  );
}

function Notice({ tone, title, children }: { tone: 'warning' | 'danger'; title: string; children: React.ReactNode }) {
  const styles =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200'
      : 'border-red-200 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200';
  return (
    <div role="alert" className={`rounded-xl border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  );
}
