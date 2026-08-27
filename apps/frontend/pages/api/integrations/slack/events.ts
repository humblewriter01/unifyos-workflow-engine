import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getEnv } from '../../../../lib/env';

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function isValidSignature(rawBody: Buffer, timestamp: string | undefined, signature: string | undefined): boolean {
  const signingSecret = getEnv('SLACK_SIGNING_SECRET');
  if (!signingSecret || !timestamp || !signature) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 5 * 60) return false;
  const baseString = `v0:${timestamp}:${rawBody.toString('utf8')}`;
  const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;
  const actual = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return actual.length === calculated.length && crypto.timingSafeEqual(actual, calculated);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const rawBody = await readRawBody(req);
  if (!isValidSignature(rawBody, req.headers['x-slack-request-timestamp'] as string | undefined, req.headers['x-slack-signature'] as string | undefined)) {
    return res.status(401).json({ success: false, error: 'Invalid Slack signature.' });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload.' });
  }

  if (payload.type === 'url_verification' && typeof payload.challenge === 'string') {
    return res.status(200).json({ challenge: payload.challenge });
  }

  // Acknowledge quickly; event processing can be connected to the workflow queue later.
  console.info('[Slack] Event received', { type: payload.event?.type, teamId: payload.team_id });
  return res.status(200).json({ ok: true });
}
