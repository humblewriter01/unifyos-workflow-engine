import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';

export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : void router.push(fallback))}
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-dark-700 dark:bg-dark-800 dark:text-neutral-200 dark:hover:bg-dark-700"
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}
