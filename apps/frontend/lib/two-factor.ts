import { randomBytes } from 'crypto';
import { compare, hash } from 'bcryptjs';
import QRCode from 'qrcode';
import { generateSecret, generateURI, verify } from 'otplib';

const ISSUER = 'UnifyOS';
const RECOVERY_CODE_COUNT = 10;

export function normalizeOtp(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, '').trim() : '';
}

export async function verifyTotp(secret: string, token: unknown): Promise<boolean> {
  const normalized = normalizeOtp(token);
  if (!/^\d{6}$/.test(normalized)) return false;
  const result = await verify({ secret, token: normalized, epochTolerance: 30 });
  return result.valid;
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(6).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => hash(code.replace(/-/g, '').toUpperCase(), 12)));
}

export async function consumeRecoveryCode(code: unknown, hashes: unknown): Promise<{ valid: boolean; remaining: string[] }> {
  const normalized = normalizeOtp(code).replace(/-/g, '').toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(normalized) || !Array.isArray(hashes)) {
    return { valid: false, remaining: Array.isArray(hashes) ? hashes.filter((value): value is string => typeof value === 'string') : [] };
  }

  const stored = hashes.filter((value): value is string => typeof value === 'string');
  for (let index = 0; index < stored.length; index += 1) {
    if (await compare(normalized, stored[index])) {
      return { valid: true, remaining: stored.filter((_, currentIndex) => currentIndex !== index) };
    }
  }
  return { valid: false, remaining: stored };
}

export async function createAuthenticatorSetup(email: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
  const secret = generateSecret({ length: 20 });
  const otpauthUrl = generateURI({ issuer: ISSUER, label: email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 2 });
  return { secret, otpauthUrl, qrCodeDataUrl };
}
