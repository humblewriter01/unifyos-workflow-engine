import { withAuth } from 'next-auth/middleware';

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
