import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { GOOGLE_SERVICES, type GoogleServiceDefinition } from '../../lib/google-services';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Mail,
  Presentation,
  RefreshCw,
  Unplug,
  Users,
  Play,
} from 'lucide-react';

type Status = {
  connected: boolean;
  grantedScopes: string[];
  missingScopes: string[];
  expiresAt: string | null;
  needsReconnect: boolean;
};

type TestResult = {
  ok: boolean;
  summary: string;
  payload?: unknown;
};

const ICONS: Record<string, typeof FolderOpen> = {
  drive: FolderOpen,
  docs: FileText,
  sheets: FileSpreadsheet,
  slides: Presentation,
  gmail: Mail,
  calendar: Calendar,
  forms: ClipboardList,
  tasks: CheckCircle,
  contacts: Users,
};

const CONNECT_SUCCESS = 'google_connected';

function summarize(serviceId: string, data: Record<string, any>): string {
  switch (serviceId) {
    case 'gmail': {
      const messages = data.messages ?? [];
      const first = messages[0];
      return `${messages.length} unread message(s)${first?.subject ? ` — latest: “${first.subject}”` : ''}`;
    }
    case 'calendar':
      return `${data.events?.length ?? 0} upcoming event(s)`;
    case 'drive':
      return `${data.files?.length ?? 0} file(s) returned`;
    case 'docs':
      return `Created document ${data.documentId}`;
    case 'slides':
      return `Created presentation ${data.presentationId}`;
    case 'sheets':
      return `Read ${data.rowCount ?? 0} row(s) from ${data.range ?? 'the sheet'}`;
    case 'forms':
      return `${data.forms?.length ?? 0} form(s) found`;
    case 'tasks':
      return `Created task “${data.title ?? data.id}”`;
    case 'contacts':
      return `${data.contacts?.length ?? 0} contact(s) found`;
    default:
      return 'Request succeeded';
  }
}

export default function IntegrationsSettings() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [busyService, setBusyService] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult | undefined>>({});
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sheetInput, setSheetInput] = useState({ spreadsheetId: '', range: '' });

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const response = await fetch('/api/integrations/google/status');
      if (!response.ok) {
        setStatus(null);
        return;
      }
      const payload = await response.json();
      setStatus(payload?.data ?? null);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // The OAuth callback returns here with ?success / ?error, then forget it.
  useEffect(() => {
    if (!router.isReady) return;

    const success = typeof router.query.success === 'string' ? router.query.success : undefined;
    const error = typeof router.query.error === 'string' ? router.query.error : undefined;

    if (success === CONNECT_SUCCESS) {
      setBanner({ type: 'success', text: 'Google Workspace connected. Run a test below to confirm each API.' });
      void loadStatus();
    } else if (error) {
      setBanner({ type: 'error', text: `Google connection failed: ${error.replace(/_/g, ' ')}.` });
    }

    if (success || error) {
      const { success: _s, error: _e, ...rest } = router.query;
      void router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [router, loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setBanner(null);
    try {
      const response = await fetch('/api/apps/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: '/settings/integrations' }),
      });
      const payload = await response.json().catch(() => ({}));

      const authUrl = payload?.data?.authUrl;
      if (!response.ok || typeof authUrl !== 'string') {
        setBanner({
          type: 'error',
          text: payload?.error || 'Could not start the Google connection. Check that the Google credentials are configured.',
        });
        return;
      }

      window.location.href = authUrl;
    } catch {
      setBanner({ type: 'error', text: 'Could not reach the server. Please try again.' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    setBanner(null);
    try {
      await fetch('/api/apps/google/connect', { method: 'DELETE' });
      setResults({});
      await loadStatus();
      setBanner({ type: 'success', text: 'Google Workspace disconnected.' });
    } catch {
      setBanner({ type: 'error', text: 'Could not disconnect. Please try again.' });
    } finally {
      setConnecting(false);
    }
  };

  const runTest = async (service: GoogleServiceDefinition) => {
    setBusyService(service.id);
    setResults((previous) => ({ ...previous, [service.id]: undefined }));

    try {
      const init: RequestInit =
        service.method === 'GET'
          ? { method: 'GET' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                service.id === 'sheets'
                  ? {
                      spreadsheetId: sheetInput.spreadsheetId.trim(),
                      ...(sheetInput.range.trim() ? { range: sheetInput.range.trim() } : {}),
                    }
                  : {},
              ),
            };

      const response = await fetch(service.testPath, init);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        setResults((previous) => ({
          ...previous,
          [service.id]: {
            ok: false,
            summary: payload?.error || `Request failed (HTTP ${response.status})`,
            payload,
          },
        }));
        return;
      }

      const data = payload?.data ?? {};
      setResults((previous) => ({
        ...previous,
        [service.id]: { ok: true, summary: summarize(service.id, data), payload: data },
      }));
    } catch {
      setResults((previous) => ({
        ...previous,
        [service.id]: { ok: false, summary: 'Network error while calling the API route.' },
      }));
    } finally {
      setBusyService(null);
    }
  };

  const connected = Boolean(status?.connected);
  const missingCount = status?.missingScopes.length ?? 0;

  const headerNote = useMemo(() => {
    if (statusLoading) return 'Checking your Google connection…';
    if (!connected) return 'Connect a Google account to enable Drive, Docs, Sheets, Slides, Gmail, Calendar, Forms, Tasks and Contacts.';
    if (status?.needsReconnect) return 'Your Google connection cannot be refreshed. Reconnect to restore access.';
    if (missingCount > 0) return `${missingCount} permission(s) were not granted. Reconnect and tick every checkbox to enable all services.`;
    return 'Google Workspace is connected with all required permissions.';
  }, [connected, missingCount, status?.needsReconnect, statusLoading]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Google Workspace integrations</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{headerNote}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-neutral-300 dark:border-dark-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-dark-700"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Refresh
            </button>

            {connected ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg font-medium"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Reconnect
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
                >
                  <Unplug className="w-4 h-4" aria-hidden="true" />
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={connecting || statusLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg font-medium"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Connect Google
              </button>
            )}
          </div>
        </header>

        {banner && (
          <div
            role="alert"
            className={
              banner.type === 'success'
                ? 'flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-4'
                : 'flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-4'
            }
          >
            {banner.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <p className={`text-sm ${banner.type === 'success' ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
              {banner.text}
            </p>
          </div>
        )}

        {!statusLoading && connected && (
          <section className="rounded-lg border border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Granted permissions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {status?.grantedScopes.length ? (
                status.grantedScopes.map((scope) => (
                  <span
                    key={scope}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400"
                  >
                    <CheckCircle className="w-3 h-3" aria-hidden="true" />
                    {scope.replace('https://www.googleapis.com/auth/', '')}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Scopes were not recorded for this connection.</span>
              )}
            </div>
            {missingCount > 0 && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                Not granted: {status?.missingScopes.map((scope) => scope.replace('https://www.googleapis.com/auth/', '')).join(', ')}
              </p>
            )}
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GOOGLE_SERVICES.map((service) => {
            const Icon = ICONS[service.id] ?? FolderOpen;
            const result = results[service.id];
            const busy = busyService === service.id;
            const needsSheetId = service.id === 'sheets';

            return (
              <article
                key={service.id}
                className="flex flex-col rounded-xl border border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-neutral-900 dark:text-white">{service.name}</h3>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{service.description}</p>
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-neutral-500 dark:text-neutral-500">
                  {service.testLabel}
                </p>

                {needsSheetId && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={sheetInput.spreadsheetId}
                      onChange={(event) => setSheetInput((prev) => ({ ...prev, spreadsheetId: event.target.value }))}
                      placeholder="Spreadsheet ID (from Drive)"
                      className="w-full rounded-lg border border-neutral-300 dark:border-dark-600 bg-neutral-50 dark:bg-dark-700 px-3 py-2 text-xs text-neutral-900 dark:text-white"
                      aria-label="Spreadsheet ID"
                    />
                    <input
                      type="text"
                      value={sheetInput.range}
                      onChange={(event) => setSheetInput((prev) => ({ ...prev, range: event.target.value }))}
                      placeholder="Range, e.g. Sheet1!A1:E20 (optional)"
                      className="w-full rounded-lg border border-neutral-300 dark:border-dark-600 bg-neutral-50 dark:bg-dark-700 px-3 py-2 text-xs text-neutral-900 dark:text-white"
                      aria-label="Sheet range"
                    />
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runTest(service)}
                    disabled={!connected || busy || (needsSheetId && !sheetInput.spreadsheetId.trim())}
                    className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 dark:bg-dark-700 px-3 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-dark-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
                    Test
                  </button>
                  {!connected && <span className="text-[11px] text-neutral-500 dark:text-neutral-500">Connect first</span>}
                </div>

                {result && (
                  <div className="mt-3">
                    <p className={`flex items-start gap-1.5 text-xs ${result.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {result.ok ? (
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <span>{result.summary}</span>
                    </p>
                    {result.payload ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-neutral-500 dark:text-neutral-500">Raw response</summary>
                        <pre className="mt-1 max-h-48 overflow-auto rounded bg-neutral-50 dark:bg-dark-900 p-2 text-[10px] text-neutral-700 dark:text-neutral-300">
                          {JSON.stringify(result.payload, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-500">
          Drive is the entry point for Docs, Sheets, Slides and Forms — those APIs address files by the ID Drive returns.
          Google Meet links are created through Calendar&apos;s <code>conferenceData</code>, so no separate Meet permission is required.
        </p>
      </div>
    </DashboardLayout>
  );
}
