import crypto from 'crypto';
import { getEnv } from './env';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export type PaystackResponse<T> = { status: boolean; message: string; data: T };

function secretKey(): string {
  const key = getEnv('PAYSTACK_SECRET_KEY', ['PAYSTACK_SECRET']);
  if (!key) throw new Error('PAYSTACK_NOT_CONFIGURED');
  return key;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.status) {
    throw new Error('PAYSTACK_REQUEST_FAILED');
  }
  return body as T;
}

export type InitializeData = { authorization_url: string; access_code: string; reference: string };
export type VerifyData = { status: string; amount: number; currency: string; reference: string; id: number; customer?: { email?: string } };

export function initializeTransaction(input: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callback_url: string;
  metadata: Record<string, string>;
}) {
  return request<PaystackResponse<InitializeData>>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function verifyTransaction(reference: string) {
  return request<PaystackResponse<VerifyData>>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
}

export function createRefund(input: { transaction: string; amount?: number }) {
  return request<PaystackResponse<Record<string, unknown>>>('/refund', { method: 'POST', body: JSON.stringify(input) });
}

export function verifyWebhookSignature(rawBody: string, signature: string | string[] | undefined): boolean {
  if (!signature || Array.isArray(signature)) return false;
  const expected = crypto.createHmac('sha512', secretKey()).update(rawBody, 'utf8').digest('hex');
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
