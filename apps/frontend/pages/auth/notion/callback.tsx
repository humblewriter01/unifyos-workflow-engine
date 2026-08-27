import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function NotionCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const query = new URLSearchParams();
    for (const key of ['code', 'state', 'error', 'error_description']) {
      const value = router.query[key];
      if (typeof value === 'string') query.set(key, value);
    }
    window.location.replace(`/api/apps/notion/callback?${query.toString()}`);
  }, [router.isReady, router.query]);

  return <main className="min-h-screen flex items-center justify-center text-neutral-600">Completing Notion connection…</main>;
}
