import { withAuth } from 'next-auth/middleware';
import { getEnv } from './lib/env';

const nextAuthSecret = getEnv('NEXTAUTH_SECRET');
if (nextAuthSecret) process.env.NEXTAUTH_SECRET = nextAuthSecret;

export default withAuth({
  pages: { signIn: '/auth/login' },
  callbacks: {
    authorized: ({ token }) => Boolean(token),
  },
});

export const config = {
  matcher: [
    '/',
    '/apps/:path*',
    '/workflows/:path*',
    '/analytics/:path*',
    '/inbox/:path*',
    '/contact/:path*',
    '/settings/:path*',
  ],
};
