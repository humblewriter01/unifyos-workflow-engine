// apps/frontend/pages/api/contact/support.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { getEnv, isEmailConfigured } from '../../../lib/env';
import { getAppBaseUrl } from '../../../lib/app-url';
import { createSupportTicket } from '../../../lib/support-tickets';

/**
 * Contact form.
 *
 * The ticket is persisted **before** any email is attempted. Previously this
 * route only sent mail, so a Resend outage (or a missing `SUPPORT_EMAIL`) lost
 * the message entirely. Now the admin inbox at /admin/support always has it,
 * and email delivery is best-effort on top.
 */

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function sendEmail(
  apiKey: string,
  payload: { from: string; to: string[]; subject: string; html: string },
): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error('Support email rejected:', await response.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('Support email failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const baseUrl = getAppBaseUrl(req);
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id ?? null;

  const name = clean(req.body?.name, 120);
  const email = clean(req.body?.email, 254);
  const subject = clean(req.body?.subject, 200);
  const message = clean(req.body?.message, 10_000);
  const category = clean(req.body?.category, 60);

  if (!name || !email || !subject || !message || !category) {
    return res.status(400).json({
      success: false,
      error: { code: 'FIELDS_REQUIRED', message: 'All fields are required.' },
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_EMAIL', message: 'Enter a valid email address so we can reply.' },
    });
  }

  // 1. Persist. This is the part that must not be lost.
  let ticketId: string | null = null;
  try {
    ticketId = await createSupportTicket({ name, email, subject, message, category, userId }, req);
  } catch (error) {
    console.error('Support ticket persistence failed:', error instanceof Error ? error.message : error);
  }

  const resendApiKey = getEnv('RESEND_API_KEY', ['RESENDER_API_KEY']);
  const supportEmail = getEnv('SUPPORT_EMAIL');
  const emailReady = Boolean(resendApiKey && supportEmail && isEmailConfigured());

  // 2. Notify, best effort.
  let supportNotified = false;
  let userNotified = false;
  if (resendApiKey && supportEmail) {
    supportNotified = await sendEmail(resendApiKey, {
      from: 'UnifyOS Support <support@unifyos.com>',
      to: [supportEmail],
      subject: `[UnifyOS Support] ${category}: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🎯 New UnifyOS Support Request</h2>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <table style="width: 100%;">
              <tr><td style="padding: 4px 0;"><strong>Category:</strong></td><td style="padding: 4px 0;">${escapeHtml(category.toUpperCase())}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>From:</strong></td><td style="padding: 4px 0;">${escapeHtml(name)} (${escapeHtml(email)})</td></tr>
              <tr><td style="padding: 4px 0;"><strong>User ID:</strong></td><td style="padding: 4px 0;">${escapeHtml(session?.user?.id || 'Not logged in')}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Ticket:</strong></td><td style="padding: 4px 0;">${escapeHtml(ticketId ?? 'not stored')}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Submitted:</strong></td><td style="padding: 4px 0;">${escapeHtml(new Date().toLocaleString())}</td></tr>
            </table>
          </div>
          <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0; color: #1e293b;">${escapeHtml(subject)}</h3>
            <div style="white-space: pre-wrap; line-height: 1.6; color: #475569;">${escapeHtml(message)}</div>
          </div>
          <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
            <a href="${escapeHtml(baseUrl)}/admin/support" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">Open the support inbox</a>
          </div>
        </div>
      `,
    });
  }

  if (resendApiKey) {
    userNotified = await sendEmail(resendApiKey, {
      from: 'UnifyOS Support <support@unifyos.com>',
      to: [email],
      subject: 'We received your support request 🚀',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Thanks for reaching out!</h1>
          <p>Hi ${escapeHtml(name)},</p>
          <p>We've received your support request and our team will review it shortly. We typically respond within 24 hours.</p>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0369a1;">Request Summary</h3>
            <table style="width: 100%;">
              <tr><td style="padding: 8px 0; color: #475569;"><strong>Reference:</strong></td><td style="padding: 8px 0;">${escapeHtml(ticketId ?? String(Date.now()))}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569;"><strong>Category:</strong></td><td style="padding: 8px 0;">${escapeHtml(category)}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569;"><strong>Subject:</strong></td><td style="padding: 8px 0;">${escapeHtml(subject)}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569;"><strong>Submitted:</strong></td><td style="padding: 8px 0;">${escapeHtml(new Date().toLocaleString())}</td></tr>
            </table>
          </div>
          <div style="background: white; padding: 16px; border-left: 4px solid #2563eb; margin: 16px 0;">
            <p style="white-space: pre-wrap; margin: 0; color: #475569;">${escapeHtml(message)}</p>
          </div>
          <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Best regards,<br><strong>The UnifyOS Team</strong></p>
        </div>
      `,
    });
  }

  // The message is safe if it was stored. Only report failure when it was
  // neither stored nor delivered.
  if (!ticketId && !supportNotified) {
    return res.status(503).json({
      success: false,
      error: { code: 'SUPPORT_UNAVAILABLE', message: 'Your message could not be submitted. Please try again shortly.' },
    });
  }

  return res.status(200).json({
    success: true,
    data: { ticketId, supportNotified, userNotified, emailReady },
    message: ticketId
      ? 'Support request received. Our team will review it shortly.'
      : 'Your request was sent to our support team.',
  });
}
