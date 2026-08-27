import crypto from 'crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for OAuth state signing');
  return secret;
}

export function createOAuthState(appId: string, userId: string): string {
  const payload = `${appId}:${userId}:${Date.now()}`;
  const signature = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
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
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hexadecimal characters');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}
