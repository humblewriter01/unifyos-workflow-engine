import crypto from 'crypto';
import { getEnv } from './env';

/**
 * Short-lived impersonation links.
 *
 * Security properties:
 *  - The payload is HMAC-SHA256 signed with `NEXTAUTH_SECRET`; it cannot be
 *    forged or edited without the server secret.
 *  - It expires after 60 minutes and is **single use**: consuming it marks the
 *    issuing audit row as used, and a second attempt is rejected.
 *  - It is only issued to a SUPER_ADMIN, over an authenticated request, and
 *    every issue/consume is written to `admin_audit_logs`.
 *  - It contains no password material. The session it mints is a normal
 *    NextAuth JWT for the target user with a 1-hour lifetime.
 */

export const IMPERSONATION_TTL_SECONDS = 60 * 60;

export interface ImpersonationClaims {
  /** Admin who issued the link. */
  adm: string;
  /** Target user. */
  tgt: string;
  /** Unique token id, used for single-use enforcement. */
  jti: string;
  /** Expiry, seconds since epoch. */
  exp: number;
  aud: 'impersonate';
}

function secret(): string {
  const value = getEnv('NEXTAUTH_SECRET');
  if (!value) throw new Error('IMPERSONATION_NOT_CONFIGURED');
  return value;
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

export function createImpersonationToken(input: { adminId: string; targetUserId: string }): {
  token: string;
  claims: ImpersonationClaims;
} {
  const claims: ImpersonationClaims = {
    adm: input.adminId,
    tgt: input.targetUserId,
    jti: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + IMPERSONATION_TTL_SECONDS,
    aud: 'impersonate',
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return { token: `${body}.${sign(body)}`, claims };
}

export type ImpersonationFailure = 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'WRONG_AUDIENCE';

export type ImpersonationVerification =
  | { ok: true; claims: ImpersonationClaims }
  | { ok: false; reason: ImpersonationFailure };

/**
 * Type guard; `strict: false` disables boolean-literal discriminant narrowing
 * on the plain `if (!verified.ok)` form, so callers use this instead.
 */
export function isVerifiedImpersonation(
  result: ImpersonationVerification,
): result is { ok: true; claims: ImpersonationClaims } {
  return result.ok === true;
}

export function verifyImpersonationToken(token: string): ImpersonationVerification {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'MALFORMED' };

  const [body, signature] = parts;
  const expected = sign(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }

  let claims: ImpersonationClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ImpersonationClaims;
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }

  if (claims.aud !== 'impersonate' || typeof claims.tgt !== 'string' || typeof claims.jti !== 'string') {
    return { ok: false, reason: 'WRONG_AUDIENCE' };
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
    return { ok: false, reason: 'EXPIRED' };
  }
  return { ok: true, claims };
}

/** Cookie that preserves the admin's own session while impersonating. */
export const ADMIN_SESSION_BACKUP_COOKIE = 'unifyos.admin-session';

export function sessionCookieName(secure: boolean): string {
  return secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}
