import crypto from 'crypto';
import { getEnv } from './env';

type AuthTokenPayload = {
  purpose: 'email_verification' | 'password_reset';
  sub: string;
  exp: number;
};

function getSecret(): string {
  const secret = getEnv('NEXTAUTH_SECRET');
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for authentication tokens');
  return secret;
}

export function createAuthToken(purpose: AuthTokenPayload['purpose'], subject: string, ttlMs: number): string {
  const payload: AuthTokenPayload = {
    purpose,
    sub: subject,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string, purpose: AuthTokenPayload['purpose']): string | null {
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url');
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (payload.purpose !== purpose || !payload.sub || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}
