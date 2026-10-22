import type { Adapter, AdapterUser } from 'next-auth/adapters';
import { PrismaAdapter } from '@next-auth/prisma-adapter';

/**
 * Derived from the adapter itself so this wrapper keeps working with the
 * project's generated Prisma client type.
 */
type PrismaLike = Parameters<typeof PrismaAdapter>[0];

/**
 * NextAuth's stock Prisma adapter assumes the canonical Auth.js schema:
 *
 *   model User {
 *     image         String?
 *     emailVerified DateTime?
 *   }
 *
 * UnifyOS' `User` model intentionally differs: it has no `image` column and
 * `emailVerified` is a non-nullable `Boolean` that also gates credentials
 * login. Passing NextAuth's payload straight to Prisma therefore fails with
 * "Unknown argument `image`" (and a NOT NULL violation for
 * `emailVerified: null`), which surfaces to the user as a failed Google
 * sign-in that bounces to the error page.
 *
 * This wrapper adapts NextAuth's payload to the existing schema in code, so
 * no migration, SQL trigger or RLS change is required.
 */

type IncomingUser = Record<string, unknown> & {
  name?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  image?: unknown;
};

function toBoolean(value: unknown): boolean {
  if (value instanceof Date) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && value) return true;
  return false;
}

function toCreatePayload(data: IncomingUser) {
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : undefined;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null;

  return {
    ...(email ? { email } : {}),
    name,
    // `image` is deliberately dropped: the column does not exist.
    emailVerified: toBoolean(data.emailVerified),
  };
}

function toUpdatePayload(data: IncomingUser) {
  const patch: Record<string, unknown> = {};

  if ('name' in data) {
    patch.name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null;
  }
  if ('email' in data && typeof data.email === 'string') {
    patch.email = data.email.trim().toLowerCase();
  }
  if ('emailVerified' in data) {
    patch.emailVerified = toBoolean(data.emailVerified);
  }
  // `image` is intentionally ignored.

  return patch;
}

type SchemaUser = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean | null;
};

/** Normalises a Prisma row into the `AdapterUser` shape NextAuth expects. */
function toAdapterUser(user: SchemaUser): AdapterUser {
  const adapterUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: null,
    emailVerified: user.emailVerified ? new Date() : null,
  };
  // `next-auth`'s module augmentation in `types/next-auth.d.ts` adds required
  // app-specific fields to `User`; they are read in the `jwt` callback, not here.
  return adapterUser as AdapterUser;
}

export function unifyosPrismaAdapter(prisma: PrismaLike): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,

    async createUser(data) {
      const user = await prisma.user.create({
        data: toCreatePayload(data as IncomingUser) as never,
      });
      return toAdapterUser(user as SchemaUser);
    },

    async updateUser(data) {
      const { id, ...rest } = data as IncomingUser & { id: string };
      const user = await prisma.user.update({
        where: { id },
        data: toUpdatePayload(rest) as never,
      });
      return toAdapterUser(user as SchemaUser);
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? toAdapterUser(user as SchemaUser) : null;
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      return user ? toAdapterUser(user as SchemaUser) : null;
    },

    async getUserByAccount(providerAccountId) {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: providerAccountId.provider,
            providerAccountId: providerAccountId.providerAccountId,
          },
        },
        include: { user: true },
      });

      return account?.user ? toAdapterUser(account.user as SchemaUser) : null;
    },
  };
}

export default unifyosPrismaAdapter;
