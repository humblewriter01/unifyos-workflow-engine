import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

/**
 * `pages.signOut` target in `authOptions`. NextAuth sends users here when a
 * sign-out is requested without an explicit callback URL; before this page
 * existed that redirect landed on a 404.
 */
export default function LogoutPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    signOut({ callbackUrl: '/auth/login', redirect: true }).catch((error) => {
      console.error('Sign-out failed:', error);
      if (active) setFailed(true);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="text-center">
        {failed ? (
          <>
            <p className="text-neutral-800 dark:text-neutral-200 font-medium">Could not sign you out automatically.</p>
            <a href="/api/auth/signout" className="mt-3 inline-block text-primary-600 hover:text-primary-700 font-medium">
              Continue to the sign-out page
            </a>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-600" aria-label="Signing out" />
            <p className="mt-4 text-neutral-600 dark:text-neutral-400">Signing you out…</p>
          </>
        )}
      </div>
    </main>
  );
}
