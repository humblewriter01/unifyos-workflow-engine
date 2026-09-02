import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhookSignature } from '../../../lib/paystack';
import prisma from '../../../lib/prisma';

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function stableEventId(event: Record<string, unknown>, rawBody: string): string {
  const data = event.data as Record<string, unknown> | undefined;
  const candidate = data?.reference || data?.transaction_reference || data?.id;
  return `${event.event || 'unknown'}:${candidate || require('crypto').createHash('sha256').update(rawBody).digest('hex')}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const rawBody = await readRawBody(req);
  if (!verifyWebhookSignature(rawBody, req.headers['x-paystack-signature'])) return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature.' } });

  let event: Record<string, any>;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid webhook payload.' } }); }
  const eventType = typeof event.event === 'string' ? event.event : 'unknown';
  const eventId = stableEventId(event, rawBody);
  try {
    const stored = await prisma.providerEvent.create({ data: { provider: 'paystack', eventId, eventType, payload: event } }).catch((error: any) => {
      if (error?.code === 'P2002') return null;
      throw error;
    });
    if (!stored) return res.status(200).json({ received: true, duplicate: true });
    res.status(200).json({ received: true });
    try {
      const data = event.data || {};
      const reference = typeof data.reference === 'string' ? data.reference : typeof data.transaction_reference === 'string' ? data.transaction_reference : null;
      if (reference && eventType === 'charge.success') {
        const payment = await prisma.payment.findUnique({ where: { reference } });
        if (payment && Number(data.amount) === payment.amount && data.currency === payment.currency) {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', providerTransactionId: data.id ? String(data.id) : undefined, verifiedAt: new Date() } });
        }
      }
      if (reference && eventType.startsWith('refund.')) {
        const status = eventType === 'refund.processed' ? 'REFUNDED' : eventType === 'refund.failed' ? 'SUCCESS' : 'REFUND_PENDING';
        await prisma.payment.updateMany({ where: { reference }, data: { status } });
      }
      await prisma.providerEvent.update({ where: { id: stored.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
    } catch (error) {
      await prisma.providerEvent.update({ where: { id: stored.id }, data: { status: 'FAILED', error: 'Provider event processing failed.' } });
    }
    return;
  } catch {
    return res.status(503).json({ success: false, error: { code: 'WEBHOOK_UNAVAILABLE', message: 'Webhook processing is temporarily unavailable.' } });
  }
}
