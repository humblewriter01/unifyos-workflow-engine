import crypto from 'crypto';
import { getEnv } from './env';

const STATE_TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret = getEnv('NEXTAUTH_SECRET');
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for OAuth state signing');
  return secret;
}

/**
 * Builds the signed OAuth `state` value.
 *
 * An optional `returnTo` (a relative in-app path) is appended as a fourth,
 * signature-covered segment so the callback can send the user back to the page
 * they started from. Existing three-segment states remain valid, because the
 * verifier only reads the first three fields.
 */
export function createOAuthState(appId: string, userId: string, returnTo?: string): string {
  const base = `${appId}:${userId}:${Date.now()}`;
  const payload = returnTo ? `${base}:${encodeURIComponent(returnTo)}` : base;
  const signature = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Returns the `returnTo` path from a state value, but only if the HMAC is valid
 * and the path is a safe relative path. Anything else yields `null`, which
 * prevents the OAuth callback from being used as an open redirect.
 */
export function getOAuthStateReturnTo(state: string, expectedAppId?: string, expectedUserId?: string): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const signatureSeparator = decoded.lastIndexOf(':');
    if (signatureSeparator < 0) return null;

    const payload = decoded.slice(0, signatureSeparator);
    const signature = decoded.slice(signatureSeparator + 1);
    const parts = payload.split(':');
    if (parts.length < 4) return null;

    const [appId, userId] = parts;
    if (expectedAppId && appId !== expectedAppId) return null;
    if (expectedUserId && userId !== expectedUserId) return null;

    const expectedSignature = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
    if (signature.length !== expectedSignature.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;

    const rawReturnTo = parts.slice(3).join(':');
    return normalizeReturnPath(decodeURIComponent(rawReturnTo));
  } catch {
    return null;
  }
}

/** Only single-slash relative paths are allowed, so `//evil.com` cannot escape. */
export function normalizeReturnPath(value?: string | null): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate.includes('\\')) return null;
  return candidate.slice(0, 500);
}

export function verifyOAuthState(state: string, expectedAppId: string, expectedUserId: string): boolean {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const separator = decoded.lastIndexOf(':');
    if (separator < 0) return false;

    const payload = decoded.slice(0, separator);
    const signature = decoded.slice(separator + 1);
    const [appId, userId, timestamp] = payload.split(':');
    if (appId !== expectedAppId || userId !== expectedUserId) return false;
    if (!timestamp || Date.now() - Number(timestamp) > STATE_TTL_MS) return false;

    const expectedSignature = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

export function encryptToken(token: string): string {
  const key = Buffer.from(getEnv('ENCRYPTION_KEY') || '', 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hexadecimal characters');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(value: string): string | null {
  try {
    const [ivValue, authTagValue, encryptedValue] = value.split(':');
    const key = Buffer.from(getEnv('ENCRYPTION_KEY') || '', 'hex');
    if (key.length !== 32 || !ivValue || !authTagValue || !encryptedValue) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagValue, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
