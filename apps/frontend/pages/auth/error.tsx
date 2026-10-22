import Link from 'next/link';
import { useRouter } from 'next/router';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

/**
 * NextAuth redirects here with `?error=<code>` whenever a provider flow is
 * rejected (`pages.error` in `authOptions`). Without this page every Google
 * OAuth rejection ended on a generic 404, which is why the redirect looked
 * "broken" instead of explanatory.
 */
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Authentication is not configured',
    description:
      'The server is missing or has invalid auth settings. Check NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the deployment environment.',
  },
  OAuthSignin: {
    title: 'Could not start Google sign-in',
    description:
      'The authorization request could not be built. Verify the Google OAuth client ID and that the deployment URL is registered as an authorized origin.',
  },
  OAuthCallback: {
    title: 'Google sign-in could not be completed',
    description:
      'Google returned an error while completing the exchange. This usually means the redirect URI registered in Google Cloud Console does not exactly match the deployment URL.',
  },
  OAuthCreateAccount: {
    title: 'Could not create your account',
    description:
      'Your Google identity was verified but the account could not be saved. Please try again, or sign in with your email and password.',
  },
  OAuthAccountNotLinked: {
    title: 'This email is already registered',
    description:
      'An account with this email address already exists. Sign in with your email and password instead, then connect Google from Settings.',
  },
  EmailCreateAccount: {
    title: 'Could not create your account',
    description: 'The account could not be saved. Please try again in a moment.',
  },
  AccessDenied: {
    title: 'Access denied',
    description:
      'The sign-in was cancelled, or this account is not allowed to use the application. You can try again with a different Google account.',
  },
  Verification: {
    title: 'Sign-in link has expired',
    description: 'The verification link is no longer valid. Request a new one and try again.',
  },
  CredentialsSignin: {
    title: 'Invalid email or password',
    description: 'Check your credentials and try again. Accounts must verify their email before signing in.',
  },
  SessionRequired: {
    title: 'Please sign in',
    description: 'You need to be signed in to view that page.',
  },
  Default: {
    title: 'Sign-in failed',
    description: 'Something went wrong while signing you in. Please try again.',
  },
};

export default function AuthErrorPage() {
  const router = useRouter();
  const code = typeof router.query.error === 'string' ? router.query.error : 'Default';
  const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Default;

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <section
        aria-labelledby="auth-error-heading"
        className="w-full max-w-md bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <h1 id="auth-error-heading" className="text-xl font-bold text-neutral-900 dark:text-white">
            {message.title}
          </h1>
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-400">{message.description}</p>

        <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">
          Reference code: <code className="font-mono">{code}</code>
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try signing in again
          </Link>
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 dark:border-dark-600 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
