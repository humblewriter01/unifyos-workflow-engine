import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Megaphone, ShieldAlert, X } from 'lucide-react';

/**
 * Two persistent bars shown above the dashboard content:
 *
 * 1. **Announcement** — the message an administrator published in
 *    /admin/announcements. Dismissal is remembered per announcement id, so a new
 *    message reappears for everyone who dismissed the previous one.
 * 2. **Impersonation** — a loud reminder when an operator is viewing the app as
 *    a customer, with a one-click way back to their own session.
 */

interface Announcement {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'critical';
  publishedAt: string;
  expiresAt: string | null;
}

interface ImpersonationStatus {
  impersonating: boolean;
  adminEmail?: string | null;
  userEmail?: string | null;
}

const DISMISS_PREFIX = 'unifyos.announcement.dismissed.';

const TONE_STYLES: Record<Announcement['tone'], string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800/60 dark:bg-blue-900/25 dark:text-blue-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-900/25 dark:text-emerald-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/25 dark:text-amber-100',
  critical: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-900/25 dark:text-red-100',
};

const TONE_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

function readDismissed(id: string): boolean {
  try {
    return window.localStorage.getItem(`${DISMISS_PREFIX}${id}`) === '1';
  } catch {
    // Storage can be blocked (private mode, third-party cookie rules); showing
    // the banner again is the safe default.
    return false;
  }
}

function writeDismissed(id: string): void {
  try {
    window.localStorage.setItem(`${DISMISS_PREFIX}${id}`, '1');
    // Keep the keyspace small: only the last 20 dismissed ids are kept.
    const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(DISMISS_PREFIX));
    if (keys.length > 20) keys.slice(0, keys.length - 20).forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export default function DashboardBanners() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationStatus | null>(null);

  const load = useCallback(async () => {
    const [bannerResponse, impersonationResponse] = await Promise.all([
      fetch('/api/announcements/current').catch(() => null),
      fetch('/api/admin/impersonation-status').catch(() => null),
    ]);

    if (bannerResponse?.ok) {
      const body = await bannerResponse.json().catch(() => null);
      const current: Announcement | null = body?.data?.current ?? null;
      setAnnouncement(current);
      setDismissed(current ? readDismissed(current.id) : false);
    }

    if (impersonationResponse?.ok) {
      const body = await impersonationResponse.json().catch(() => null);
      if (body?.data?.impersonating) setImpersonation(body.data);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const Icon = announcement ? TONE_ICONS[announcement.tone] : Megaphone;
  const showAnnouncement = Boolean(announcement) && !dismissed;

  if (!showAnnouncement && !impersonation?.impersonating) return null;

  return (
    <div className="space-y-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-dark-700 dark:bg-dark-900/40 sm:px-6">
      {impersonation?.impersonating && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Impersonating <strong>{impersonation.userEmail ?? 'this account'}</strong>
              {impersonation.adminEmail ? ` — you are still signed in as ${impersonation.adminEmail}` : ''}
            </span>
          </span>
          <a
            href="/api/admin/impersonate/stop"
            className="inline-flex min-h-[32px] shrink-0 items-center rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Stop impersonating
          </a>
        </div>
      )}

      {showAnnouncement && announcement && (
        <div role="status" className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${TONE_STYLES[announcement.tone]}`}>
          <span className="flex min-w-0 items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-pre-wrap break-words">{announcement.message}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              writeDismissed(announcement.id);
              setDismissed(true);
            }}
            aria-label="Dismiss announcement"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
