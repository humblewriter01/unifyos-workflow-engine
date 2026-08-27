import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const queryToken = typeof router.query.token === 'string' ? router.query.token : '';
    setToken(queryToken);
    if (!queryToken) setError('This password-reset link is missing or invalid. Request a new one.');
  }, [router.isReady, router.query.token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This password-reset link is missing or invalid. Request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError('Password must be between 8 and 128 characters.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to reset your password.');
      setSuccess(true);
      window.setTimeout(() => void router.replace('/auth/login?reset=1'), 1600);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset your password.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8 max-w-md w-full text-center">
          <CheckCircle className="w-14 h-14 text-emerald-600 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Password updated</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Redirecting you to sign in…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl shadow-lg mb-4"><Lock className="w-8 h-8 text-white" aria-hidden="true" /></div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Reset password</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Choose a new password for your account</p>
        </div>

        <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8" aria-labelledby="reset-heading">
          <h2 id="reset-heading" className="sr-only">Create a new password</h2>
          {error && <div role="alert" className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3"><AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" aria-hidden="true" /><p className="text-sm text-red-800 dark:text-red-300">{error}</p></div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">New password</label>
              <div className="relative">
                <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} className="w-full px-4 pr-12 py-3 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white" placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Confirm password</label>
              <input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={128} className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white" placeholder="Repeat your password" />
            </div>
            <button type="submit" disabled={loading || !token} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium">{loading && <Loader2 className="w-5 h-5 animate-spin" />}{loading ? 'Updating password…' : 'Update password'}</button>
          </form>
          <p className="text-center mt-6"><Link href="/auth/login" className="text-sm text-primary-600 hover:text-primary-700">Back to sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
