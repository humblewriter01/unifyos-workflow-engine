// apps/frontend/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import prisma from '../../../lib/prisma';
import { unifyosPrismaAdapter } from '../../../lib/auth-adapter';
import { checkRateLimit, getRequestIp } from '../../../lib/rate-limit';
import { getEnv } from '../../../lib/env';
import { getConfiguredAppUrl } from '../../../lib/app-url';
import { GOOGLE_FULL_SCOPES, GOOGLE_IDENTITY_SCOPES } from '../../../lib/google-scopes';
import { decryptAuthSecret } from '../../../lib/auth-tokens';
import { consumeRecoveryCode, verifyTotp } from '../../../lib/two-factor';

const nextAuthSecret = getEnv('NEXTAUTH_SECRET');

/**
 * next-auth 4.24.x returns `NEXTAUTH_URL` verbatim as the origin when it is set,
 * *before* it looks at the Vercel/Render host headers. A `NEXTAUTH_URL` left at
 * `http://localhost:3000` therefore makes Google receive a localhost
 * `redirect_uri` in production. `getConfiguredAppUrl()` ignores localhost on a
 * hosted platform and falls back to the platform's public URL.
 */
const nextAuthUrl = getConfiguredAppUrl();
const googleClientId = getEnv('GOOGLE_CLIENT_ID');
const googleClientSecret = getEnv('GOOGLE_CLIENT_SECRET');
// Opt-in: link a Google identity to an existing password account that has the
// same, Google-verified email address. Off by default because it lets the
// provider decide account ownership.
const allowGoogleEmailLinking = getEnv('AUTH_ALLOW_GOOGLE_EMAIL_LINKING') === 'true';

/**
 * Sign-in asks for the full Google Workspace suite by default. Flip
 * GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY=true to request only `openid email profile`
 * at sign-in and leave Workspace grants to the explicit Connect flow.
 */
const googleSignInScopes =
  getEnv('GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY') === 'true' ? [...GOOGLE_IDENTITY_SCOPES] : GOOGLE_FULL_SCOPES;
if (nextAuthSecret) process.env.NEXTAUTH_SECRET = nextAuthSecret;
if (nextAuthUrl) {
  process.env.NEXTAUTH_URL = nextAuthUrl;
} else if (process.env.NEXTAUTH_URL) {
  // Localhost on a hosted deployment: drop it so next-auth falls back to the
  // request host instead of building localhost callback URLs.
  console.warn('[auth] Ignoring a localhost NEXTAUTH_URL on a hosted deployment.');
  delete process.env.NEXTAUTH_URL;
}

const providers = [
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
      twoFactorCode: { label: 'Authenticator code', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Invalid credentials');
      }

      const email = credentials.email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) throw new Error('Invalid credentials');

      const isPasswordValid = await compare(credentials.password, user.passwordHash);
      if (!isPasswordValid) throw new Error('Invalid credentials');
      if (!user.emailVerified) throw new Error('Please verify your email before logging in');

      if (user.twoFactorEnabled) {
        const secret = user.twoFactorSecret ? decryptAuthSecret(user.twoFactorSecret) : null;
        const validTotp = secret ? await verifyTotp(secret, credentials.twoFactorCode) : false;
        const recovery = validTotp
          ? { valid: false, remaining: [] as string[] }
          : await consumeRecoveryCode(credentials.twoFactorCode, user.twoFactorRecoveryCodes);
        if (!validTotp && !recovery.valid) throw new Error('Invalid credentials');
        if (recovery.valid) {
          await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecoveryCodes: recovery.remaining } });
        }
      }

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return { id: user.id, email: user.email, name: user.name, plan: user.plan, adminRole: user.adminRole };
    },
  }),
  ...(googleClientId && googleClientSecret
    ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          // Google redirects back to `<origin>/api/auth/callback/google`.
          // NextAuth derives that origin from the incoming request on Vercel,
          // so no absolute URL has to be hardcoded here.
          allowDangerousEmailAccountLinking: allowGoogleEmailLinking,
          authorization: {
            params: {
              // Google Workspace suite (Drive, Docs, Sheets, Slides, Gmail,
              // Calendar, Forms, Tasks, Contacts).
              //
              // Sign-in uses `prompt=select_account`, not `prompt=consent`.
              // Forcing consent here made every single login re-display the
              // Google consent screen, which reads to users like a bug. The
              // account chooser is still shown (so multi-account users can
              // switch), but an already-granted login is silent.
              //
              // Refresh tokens are NOT collected at sign-in: the
              // /settings/integrations "Connect" button posts to
              // /api/apps/google/connect, which issues its own authorization
              // request with `access_type=offline` + `prompt=consent`. Workspace
              // tokens therefore always come from an explicit, informed grant,
              // and this sign-in config never affects them.
              //
              // Note: these are sensitive/restricted scopes, so an unverified
              // OAuth client shows a "Google hasn't verified this app" warning
              // and is capped at 100 users until Google review completes. Set
              // GOOGLE_SIGNIN_PROFILE_SCOPES_ONLY=true to keep sign-in minimal
              // (openid email profile) and grant Workspace access only through
              // the /settings/integrations "Connect" flow instead.
              prompt: 'select_account',
              access_type: 'offline',
              include_granted_scopes: true,
              scope: googleSignInScopes.join(' '),
            },
          },
        }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  adapter: unifyosPrismaAdapter(prisma),
  providers: providers as NextAuthOptions['providers'],
  secret: nextAuthSecret,

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth/login',
    // Both pages exist in this app; a missing one turns every OAuth rejection
    // into a bare 404 instead of an actionable message.
    signOut: '/auth/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-email',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
        token.adminRole = user.adminRole;

        // OAuth users come back from the adapter as a plain AdapterUser, so the
        // app-specific fields are undefined on the first sign-in. Read them from
        // the database instead of leaving the session without a plan.
        if (!token.plan || !token.adminRole) {
          const record = await prisma.user.findUnique({
            where: { id: user.id },
            select: { plan: true, adminRole: true },
          });
          if (record) {
            token.plan = record.plan;
            token.adminRole = record.adminRole;
          }
        }
      }

      // Store OAuth tokens if available
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.plan = token.plan as string;
        session.user.adminRole = token.adminRole as string;
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const profileEmail = typeof profile?.email === 'string' ? profile.email : undefined;
        const email = user.email ?? profileEmail;
        if (!email) return false;

        // IMPORTANT: never create the user here.
        //
        // NextAuth runs this callback *before* `callbackHandler` and then calls
        // `adapter.createUser()` itself. Creating the row here meant the adapter
        // found an existing user for the e-mail without a linked Account and
        // threw `OAuthAccountNotLinked`, failing every first-time Google login.
        // Creation now happens exactly once, through the adapter.
        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, emailVerified: true },
        });

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              lastLoginAt: new Date(),
              // Google has already verified this address.
              ...(existingUser.emailVerified ? {} : { emailVerified: true }),
            },
          });
        }
      }

      // For email sign-in, allow if user exists and is verified
      if (account?.provider === 'email') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        
        if (existingUser && !existingUser.emailVerified) {
          // Optionally resend verification email
          return false;
        }
      }

      return true;
    },
  },

  events: {
    async createUser({ user }) {
      // Runs once the adapter has created the row (OAuth sign-up). The schema's
      // `emailVerified` is a non-nullable Boolean that credentials login
      // requires, so mark provider-verified accounts as verified here.
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, lastLoginAt: new Date() },
        });
      } catch (error) {
        console.error('Failed to finalise OAuth user record:', error);
      }
      console.log(`New user created: ${user.email}`);
    },
    async linkAccount({ user, account }) {
      // Account linked (OAuth)
      console.log(`Account linked: ${user.email} with ${account.provider}`);
    },
    async signIn({ user, isNewUser }) {
      console.log(`User signed in: ${user.email} ${isNewUser ? '(new user)' : ''}`);
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token.email}`);
    },
  },

  debug: getEnv('NODE_ENV') === 'development',
};

const nextAuthHandler = NextAuth(authOptions);

export default async function handler(req: any, res: any) {
  const segments = Array.isArray(req.query?.nextauth) ? req.query.nextauth : [];
  const isCredentialsCallback = req.method === 'POST' && segments[0] === 'callback';
  if (isCredentialsCallback) {
    const rate = checkRateLimit(`login:${getRequestIp(req)}`, 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
    }
  }
  return nextAuthHandler(req, res);
}
