type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 dark:bg-dark-700 dark:text-neutral-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300',
  info: 'bg-primary-50 text-primary-700 dark:bg-primary-900/25 dark:text-primary-300',
};

export default function StatusPill({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Maps backend status strings to a pill tone. */
export function toneForStatus(status: string): Tone {
  switch (status) {
    case 'SUCCESS':
    case 'healthy':
    case 'ACTIVE':
      return 'success';
    case 'FAILED':
    case 'attention':
    case 'SUSPENDED':
      return 'danger';
    case 'RUNNING':
    case 'PENDING':
    case 'PAST_DUE':
    case 'GRACE_PERIOD':
      return 'warning';
    case 'CANCELLED':
    case 'not_configured':
      return 'neutral';
    default:
      return 'info';
  }
}
