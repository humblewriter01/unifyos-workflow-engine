import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState('');
  const email = useMemo(() => {
    const value = router.query.email;
    return typeof value === 'string' ? value : '';
  }, [router.query.email]);

  useEffect(() => {
    if (!router.isReady) return;
    const token = typeof router.query.token === 'string' ? router.query.token : '';
    if (!token) return;

    let active = true;
    setLoading(true);
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Verification failed.');
        if (active) {
          setSuccess(true);
          window.setTimeout(() => void router.replace('/auth/login?verified=1'), 1500);
        }
      })
      .catch((verificationError) => {
        if (active) setError(verificationError instanceof Error ? verificationError.message : 'Verification failed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, router.isReady, router.query.token]);

  const handleResend = async () => {
    const verificationEmail = email || (typeof window !== 'undefined' ? localStorage.getItem('unifyos_verification_email') || '' : '');
    if (!verificationEmail) {
      setError('Your email address is missing. Please return to sign up again.');
      return;
    }

    setResendLoading(true);
    setError('');
    setResendSuccess(false);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to resend verification email.');
      setResendSuccess(true);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8 max-w-md w-full text-center">
          <CheckCircle className="w-14 h-14 text-emerald-600 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Email verified</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Your account is active. Redirecting to sign in…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl shadow-lg mb-4"><Mail className="w-8 h-8 text-white" aria-hidden="true" /></div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Check your email</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">We sent a verification link{email ? ` to ${email}` : ' to your email address'}.</p>
        </div>

        <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8" aria-labelledby="verify-heading">
          <h2 id="verify-heading" className="sr-only">Verify your email address</h2>
          {error && <div role="alert" className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3"><AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" aria-hidden="true" /><p className="text-sm text-red-800 dark:text-red-300">{error}</p></div>}
          {resendSuccess && <div role="status" className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3"><CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" aria-hidden="true" /><p className="text-sm text-emerald-800 dark:text-emerald-300">If your account is unverified, a fresh link has been sent.</p></div>}
          {loading ? <div className="flex items-center justify-center gap-2 text-neutral-600 dark:text-neutral-400"><Loader2 className="w-5 h-5 animate-spin" />Verifying your email…</div> : <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">Open the link in the email to activate your account. The link expires after 24 hours.</p>}
          <button type="button" onClick={handleResend} disabled={resendLoading || loading} className="w-full mt-6 px-4 py-3 border border-neutral-300 dark:border-dark-600 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 disabled:opacity-60 font-medium">{resendLoading ? 'Sending…' : 'Resend verification link'}</button>
          <p className="text-center mt-6"><Link href="/auth/login" className="text-sm text-primary-600 hover:text-primary-700">Back to sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
