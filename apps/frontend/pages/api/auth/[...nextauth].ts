// apps/frontend/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcryptjs';
import prisma from '../../../../lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Email Provider for verification & password reset
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || 'smtp.resend.com',
        port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
        auth: {
          user: process.env.EMAIL_SERVER_USER || 'resend',
          pass: process.env.EMAIL_SERVER_PASSWORD || process.env.RESEND_API_KEY,
        },
      },
      from: process.env.EMAIL_FROM || 'UnifyOS <onboarding@resend.dev>',
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: provider.from,
              to: identifier,
              subject: 'Sign in to UnifyOS',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #2563eb;">Sign in to UnifyOS</h1>
                  <p>Click the link below to sign in to your account:</p>
                  <a href="${url}" 
                     style="background-color: #2563eb; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; display: inline-block;">
                    Sign in to UnifyOS
                  </a>
                  <p style="margin-top: 20px; color: #6b7280;">
                    Or copy and paste this link in your browser:<br/>
                    <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px;">
                      ${url}
                    </code>
                  </p>
                  <p style="color: #6b7280; font-size: 14px;">
                    This link will expire in 24 hours.
                  </p>
                </div>
              `,
            }),
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(`Resend error: ${error.message}`);
          }

          console.log(`✅ Sign-in email sent to ${identifier}`);
        } catch (error) {
          console.error('❌ Email sending error:', error);
          throw error;
        }
      },
    }),

    // Email/Password Provider
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials');
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error('Invalid credentials');
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email before logging in');
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        };
      },
    }),

    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile',
        },
      },
    }),
  ],

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

  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);
