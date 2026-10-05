import Link from 'next/link';
import BackButton from '../components/BackButton';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-900 dark:bg-dark-900 dark:text-white sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <BackButton fallback="/settings/account" />
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">UnifyOS information</p>
          <h1 className="mt-2 text-3xl font-bold">How we handle your data</h1>
          <p className="mt-3 max-w-3xl text-neutral-600 dark:text-neutral-300">This page explains what UnifyOS stores, why it is used, how connected apps work, and the controls available to you.</p>
        </header>
        <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-700 dark:bg-dark-800 sm:p-8">
          <article><h2 className="text-xl font-semibold">What we store</h2><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">We store account details such as your email, profile name, security settings, workflows, notifications, billing records, and audit events needed to operate and secure the service.</p></article>
          <article><h2 className="text-xl font-semibold">Connected applications</h2><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">When you connect Slack, Notion, or another provider, UnifyOS stores encrypted OAuth tokens so your approved workflows can operate. We request only the provider permissions shown during authorization. You can disconnect an application from the Connections page.</p></article>
          <article><h2 className="text-xl font-semibold">How we use data</h2><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Data is used to authenticate you, run workflows, deliver notifications, process billing, provide support, prevent abuse, maintain audit trails, and improve reliability. We do not sell your personal data.</p></article>
          <article><h2 className="text-xl font-semibold">Security</h2><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Passwords are stored as one-way hashes. Server-side integration tokens are encrypted. Administrative actions require role authorization, MFA, and audit logging.</p></article>
          <article><h2 className="text-xl font-semibold">Your controls</h2><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-600 dark:text-neutral-300"><li>Export your account data from <Link href="/settings/account" className="text-primary-600 hover:underline">Account Settings</Link>.</li><li>Disconnect connected applications from <Link href="/apps" className="text-primary-600 hover:underline">Connections</Link>.</li><li>Change your password and manage MFA from <Link href="/settings/security" className="text-primary-600 hover:underline">Security Settings</Link>.</li><li>Contact support for a privacy request or account deletion request.</li></ul></article>
          <article><h2 className="text-xl font-semibold">Data retention</h2><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">We retain information while your account is active and for as long as needed for security, legal, billing, and dispute-resolution obligations. Deletion requests are reviewed and processed through support.</p></article>
        </section>
        <p className="text-sm text-neutral-500">For questions about your information, visit <Link href="/contact" className="text-primary-600 hover:underline">Contact Support</Link>.</p>
      </div>
    </main>
  );
}
