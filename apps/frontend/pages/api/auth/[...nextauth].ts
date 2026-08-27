// apps/frontend/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcryptjs';
import prisma from '../../../lib/prisma';
import { checkRateLimit, getRequestIp } from '../../../lib/rate-limit';
import { getEnv } from '../../../lib/env';
import { decryptAuthSecret } from '../../../lib/auth-tokens';
import { consumeRecoveryCode, verifyTotp } from '../../../lib/two-factor';

const nextAuthSecret = getEnv('NEXTAUTH_SECRET');
const nextAuthUrl = getEnv('NEXTAUTH_URL');
const googleClientId = getEnv('GOOGLE_CLIENT_ID');
const googleClientSecret = getEnv('GOOGLE_CLIENT_SECRET');
if (nextAuthSecret) process.env.NEXTAUTH_SECRET = nextAuthSecret;
if (nextAuthUrl) process.env.NEXTAUTH_URL = nextAuthUrl;

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
      return { id: user.id, email: user.email, name: user.name, plan: user.plan };
    },
  }),
  ...(googleClientId && googleClientSecret
    ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          authorization: {
            params: {
              prompt: 'consent',
              access_type: 'offline',
              response_type: 'code',
              scope: 'openid email profile',
            },
          },
        }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: providers as NextAuthOptions['providers'],
  secret: nextAuthSecret,

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-email',
    newUser: '/auth/welcome', // Optional welcome page
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
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
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      // For OAuth providers, ensure user exists and is verified
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          // Create new user from OAuth
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              emailVerified: true,
              plan: 'FREE',
            },
          });
        } else {
          // Update last login
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { lastLoginAt: new Date() },
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
      // User created via email sign-up
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
