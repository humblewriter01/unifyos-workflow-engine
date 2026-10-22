import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../lib/admin-auth';
import { AUDIT_ACTIONS, logAdminEvent } from '../../../lib/admin-events';
import { sendEmail } from '../../../lib/email';
import { isEmailConfigured } from '../../../lib/env';
import { getAppBaseUrl } from '../../../lib/app-url';
import prisma from '../../../lib/prisma';

/**
 * Targeted email blast.
 *
 * GET  — audience preview: how many recipients each segment has.
 * POST — { plan: 'ALL' | 'FREE' | 'PRO' | 'BUSINESS', subject, body, dryRun? }
 *
 * `dryRun` resolves the audience and sends the first message to the calling
 * admin only, so a template can be checked without mailing the whole segment.
 * Sends run with bounded concurrency to stay inside Resend's rate limits and
 * the serverless timeout; the audit row records exactly how many were reached.
 */
const AUDIENCES = ['ALL', 'FREE', 'PRO', 'BUSINESS'] as const;
type Audience = (typeof AUDIENCES)[number];

const CONCURRENCY = 5;
const MAX_RECIPIENTS = 500;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text from the operator → the branded HTML email. */
function renderBlast(body: string, opts: { preheader: string }): string {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px;line-height:1.6;color:#1f2937;">${block.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(opts.preheader)}</span>
      <h1 style="font-size:20px;color:#111827;margin:0 0 20px;">UnifyOS</h1>
      ${paragraphs}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="font-size:12px;color:#6b7280;line-height:1.5;">
        You are receiving this because you have a UnifyOS account.
      </p>
    </div>
  `;
}

function planFilter(audience: Audience) {
  return audience === 'ALL' ? {} : { plan: audience as 'FREE' | 'PRO' | 'BUSINESS' };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  if (req.method === 'GET') {
    try {
      const counts = await Promise.all(
        AUDIENCES.map(async (audience) => ({
          audience,
          recipients: await prisma.user.count({ where: { ...planFilter(audience), email: { not: '' } } }),
        })),
      );
      return res.status(200).json({
        success: true,
        data: { audiences: counts, emailConfigured: isEmailConfigured() },
      });
    } catch (error) {
      console.error('Email blast preview error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'EMAIL_AUDIENCE_UNAVAILABLE', message: 'The recipient list is temporarily unavailable.' },
      });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const audience = (typeof req.body?.plan === 'string' ? req.body.plan.toUpperCase() : 'ALL') as Audience;
  if (!AUDIENCES.includes(audience)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AUDIENCE', message: 'Audience must be ALL, FREE, PRO, or BUSINESS.' } });
  }
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 200) : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 10_000) : '';
  const dryRun = req.body?.dryRun === true;

  if (!subject) {
    return res.status(400).json({ success: false, error: { code: 'SUBJECT_REQUIRED', message: 'A subject is required.' } });
  }
  if (!body) {
    return res.status(400).json({ success: false, error: { code: 'BODY_REQUIRED', message: 'A message body is required.' } });
  }
  if (!isEmailConfigured()) {
    return res.status(503).json({
      success: false,
      error: { code: 'EMAIL_NOT_CONFIGURED', message: 'RESEND_API_KEY is not configured for this environment.' },
    });
  }

  try {
    const recipients = await prisma.user.findMany({
      where: { ...planFilter(audience), email: { not: '' } },
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_RECIPIENTS,
    });

    if (recipients.length === 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'NO_RECIPIENTS', message: 'No users match that audience.' },
      });
    }

    if (dryRun) {
      const sample = recipients.find((user) => user.email === admin.email) ?? recipients[0];
      await sendEmail(sample.email, `[TEST] ${subject}`, renderBlast(body, { preheader: subject }), {
        kind: 'admin_email_blast_test',
        audience,
        adminId: admin.id,
      });
      return res.status(200).json({
        success: true,
        data: { dryRun: true, audience, recipients: recipients.length, sentTo: sample.email },
        message: `Test message sent to ${sample.email}.`,
      });
    }

    const dashboardUrl = `${getAppBaseUrl(req)}/`;
    const failed: string[] = [];
    let sent = 0;

    const html = renderBlast(body, { preheader: subject });

    // Bound concurrency: five in flight, never one giant Promise.all.
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, recipients.length) }, async () => {
      while (cursor < recipients.length) {
        const index = cursor++;
        const recipient = recipients[index];
        try {
          await sendEmail(recipient.email, subject, html, {
            kind: 'admin_email_blast',
            audience,
            adminId: admin.id,
            dashboardUrl,
          });
          sent += 1;
        } catch (error) {
          failed.push(recipient.email);
          console.error('Email blast recipient failed:', recipient.email, error instanceof Error ? error.message : '');
        }
      }
    });
    await Promise.all(workers);

    await logAdminEvent({
      actor: adminActor(admin),
      action: AUDIT_ACTIONS.emailBlastSent,
      targetType: 'audience',
      targetId: audience,
      metadata: {
        audience,
        subject,
        recipients: recipients.length,
        sent,
        failed: failed.length,
        truncated: recipients.length === MAX_RECIPIENTS,
        bodyLength: body.length,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      data: { audience, recipients: recipients.length, sent, failed: failed.length, failedEmails: failed.slice(0, 20) },
      message: `Sent to ${sent} of ${recipients.length} ${audience === 'ALL' ? 'users' : `${audience} users`}.`,
    });
  } catch (error) {
    console.error('Email blast error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'EMAIL_BLAST_UNAVAILABLE', message: 'The email blast could not be sent.' },
    });
  }
}
