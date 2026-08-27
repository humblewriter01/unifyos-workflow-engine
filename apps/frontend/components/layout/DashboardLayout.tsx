import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Header from './Header';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const callbackUrl = useMemo(() => {
    const path = router.asPath || '/';
    return path.startsWith('/') && !path.startsWith('//') ? path : '/';
  }, [router.asPath]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setRedirecting(true);
      void router.replace({ pathname: '/auth/login', query: { callbackUrl } });
    }
  }, [callbackUrl, router, status]);

  if (status !== 'authenticated' || redirecting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-gray-600 dark:text-gray-300">
          <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" aria-hidden="true" />
          <span>{status === 'loading' ? 'Loading your session…' : 'Redirecting to sign in…'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMobileMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
