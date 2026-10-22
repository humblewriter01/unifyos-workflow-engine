import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  loading?: boolean;
}

const TONES: Record<NonNullable<MetricCardProps['tone']>, { text: string; bg: string }> = {
  default: { text: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  positive: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  warning: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  danger: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
};

export default function MetricCard({ label, value, hint, icon: Icon, tone = 'default', loading = false }: MetricCardProps) {
  const palette = TONES[tone];
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-dark-700 dark:bg-dark-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-neutral-100 dark:bg-dark-700" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {value === null || value === undefined ? '—' : value}
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
        </div>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${palette.bg}`}>
            <Icon className={`h-4 w-4 ${palette.text}`} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
