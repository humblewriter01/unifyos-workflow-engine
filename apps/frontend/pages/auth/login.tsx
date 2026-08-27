import { FormEvent, useEffect, useMemo, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';

function getSafeCallbackUrl(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  return candidate;
}

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const callbackUrl = useMemo(() => getSafeCallbackUrl(router.query.callbackUrl), [router.query.callbackUrl]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      void router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/providers')
      .then((response) => response.ok ? response.json() : {})
      .then((providers: Record<string, unknown>) => {
        if (active) setGoogleAvailable(Boolean(providers.google));
      })
      .catch(() => {
        if (active) setGoogleAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: normalizedEmail,
        password,
        twoFactorCode: twoFactorCode.trim(),
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        const message = result?.error === 'CredentialsSignin'
          ? 'Invalid email or password, or your email has not been verified.'
          : 'Unable to sign in. Please try again.';
        setError(message);
        return;
      }

      await router.replace(result.url || callbackUrl);
    } catch (signInError) {
      console.error('Login error:', signInError);
      setError('Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch (signInError) {
      console.error('Google login error:', signInError);
      setError('Google sign-in is currently unavailable.');
      setLoading(false);
    }
  };

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" aria-label="Loading" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl shadow-lg mb-4" aria-label="UnifyOS home">
            <span className="text-white font-bold text-2xl">U</span>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Welcome back</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Sign in to manage your workflows</p>
        </div>

        <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8" aria-labelledby="login-heading">
          <h2 id="login-heading" className="sr-only">Sign in to your account</h2>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" aria-hidden="true" />
                <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Password</label>
                <Link href="/auth/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" aria-hidden="true" />
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full pl-10 pr-12 py-3 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white" placeholder="Your password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 dark:hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="two-factor-code" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Authenticator code <span className="font-normal text-neutral-500">(if enabled)</span></label>
              <input id="two-factor-code" name="twoFactorCode" type="text" inputMode="numeric" autoComplete="one-time-code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} maxLength={14} className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white" placeholder="123456 or XXXX-XXXX-XXXX" />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Use a recovery code if you cannot access your authenticator app.</p>
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {googleAvailable && (
            <>
              <div className="flex items-center gap-3 my-6 text-xs text-neutral-500"><div className="h-px flex-1 bg-neutral-200 dark:bg-dark-600" /><span>OR</span><div className="h-px flex-1 bg-neutral-200 dark:bg-dark-600" /></div>
              <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="w-full px-4 py-3 border border-neutral-300 dark:border-dark-600 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 disabled:opacity-60 font-medium">Continue with Google</button>
            </>
          )}

          <p className="text-center text-sm text-neutral-600 dark:text-neutral-400 mt-7">
            Don&apos;t have an account? <Link href="/auth/signup" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">Create one</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
