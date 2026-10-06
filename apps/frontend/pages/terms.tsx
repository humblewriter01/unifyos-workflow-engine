import Link from 'next/link';
import BackButton from '../components/BackButton';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-900 dark:bg-dark-900 dark:text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <BackButton fallback="/auth/signup" />
        <header>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Last updated: October 2026</p>
        </header>
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 text-sm leading-6 dark:border-dark-700 dark:bg-dark-800">
          <p>UnifyOS provides workflow automation and connected-app services. You are responsible for the accuracy of your account information, the security of your credentials, and the actions performed by workflows you create.</p>
          <h2 className="text-lg font-semibold">Acceptable use</h2>
          <p>Do not use UnifyOS to violate applicable law, abuse connected services, send unauthorized content, or interfere with the availability or security of the platform.</p>
          <h2 className="text-lg font-semibold">Connected services</h2>
          <p>Connected applications remain subject to their own terms and permissions. You can disconnect an application at any time from the Connections page.</p>
          <h2 className="text-lg font-semibold">Support</h2>
          <p>For questions about these terms, visit <Link className="text-primary-600 hover:underline" href="/contact">Contact Support</Link>.</p>
        </section>
      </div>
    </main>
  );
}
