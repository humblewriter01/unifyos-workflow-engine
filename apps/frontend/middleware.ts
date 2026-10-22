import { withAuth } from 'next-auth/middleware';
import type { NextRequestWithAuth } from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { getEnv } from './lib/env';

const nextAuthSecret = getEnv('NEXTAUTH_SECRET');
if (nextAuthSecret) process.env.NEXTAUTH_SECRET = nextAuthSecret;

/**
 * Server-side gate for `/admin`.
 *
 * `/admin` used to be protected only by a client-side `useSession()` check, so
 * any signed-in user could load the shell before the API calls returned 403.
 * The page is now gated here, on the edge, using the `adminRole` claim that the
 * NextAuth `jwt` callback already writes into the session token — no database
 * round trip.
 *
 * This is a UX gate, not the security boundary: every `/api/admin/*` handler
 * still calls `requireAdmin()`, which re-reads the role from the database and
 * enforces MFA. A stale claim (role just revoked) therefore grants a page shell
 * and nothing more.
 */
const ADMIN_PREFIX = '/admin';

function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

const requireSession = withAuth({
  pages: { signIn: '/auth/login' },
  callbacks: {
    authorized: ({ token }) => Boolean(token),
  },
});

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isAdminPath(req.nextUrl.pathname)) {
    const token = await getToken({ req, secret: nextAuthSecret });

    if (!token) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/auth/login';
      loginUrl.search = '';
      loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = (token as { adminRole?: unknown }).adminRole;
    if (typeof role !== 'string' || role === 'NONE') {
      const deniedUrl = req.nextUrl.clone();
      deniedUrl.pathname = '/';
      deniedUrl.search = '';
      deniedUrl.searchParams.set('error', 'admin_forbidden');
      return NextResponse.redirect(deniedUrl);
    }

    return NextResponse.next();
  }

  return requireSession(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: [
    '/',
    '/apps/:path*',
    '/workflows/:path*',
    '/analytics/:path*',
    '/inbox/:path*',
    '/contact/:path*',
    '/settings/:path*',
    // Admin pages are matched so the role gate above runs on the server.
    '/admin',
    '/admin/:path*',
  ],
};
