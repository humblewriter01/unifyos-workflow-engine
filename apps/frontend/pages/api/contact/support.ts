// apps/frontend/pages/api/contact/support.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  const { name, email, subject, message, category } = req.body;

  // Validation
  if (!name || !email || !subject || !message || !category) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Send email to support team + your personal email
    const supportResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UnifyOS Support <support@unifyos.com>',
        to: ['ameenujaafar59@gmail.com'], // Your personal email for support
        subject: `[UnifyOS Support] ${category}: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🎯 New UnifyOS Support Request</h2>
            
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 4px 0;"><strong>Category:</strong></td>
                  <td style="padding: 4px 0;">
                    <span style="background: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                      ${category.toUpperCase()}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;"><strong>From:</strong></td>
                  <td style="padding: 4px 0;">${name} (${email})</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;"><strong>User ID:</strong></td>
                  <td style="padding: 4px 0;">${session?.user?.id || 'Not logged in'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;"><strong>Submitted:</strong></td>
                  <td style="padding: 4px 0;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #1e293b;">${subject}</h3>
              <div style="white-space: pre-wrap; line-height: 1.6; color: #475569;">${message}</div>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>💡 Quick Reply:</strong> Just reply to this email directly. Your reply will come from "UnifyOS Support" and go to ${email}
              </p>
            </div>

            <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
              <a href="https://unifyos-platform.onrender.com/admin/support" 
                 style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                 View in Admin Panel
              </a>
            </div>
          </div>
        `,
      }),
    });

    if (!supportResponse.ok) {
      throw new Error('Failed to send support email');
    }

    // Send confirmation email to user
    const userResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UnifyOS Support <support@unifyos.com>',
        to: email,
        subject: 'We received your support request 🚀',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Thanks for reaching out!</h1>
            
            <p>Hi ${name},</p>
            
            <p>We've received your support request and our team will review it shortly. We typically respond within 24 hours.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0369a1;">Request Summary</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0;">${Date.now()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Category:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background: #2563eb; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                      ${category}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Subject:</strong></td>
                  <td style="padding: 8px 0;">${subject}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Submitted:</strong></td>
                  <td style="padding: 8px 0;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: white; padding: 16px; border-left: 4px solid #2563eb; margin: 16px 0;">
              <p style="white-space: pre-wrap; margin: 0; color: #475569;">${message}</p>
            </div>
            
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">
                <strong>📚 Need immediate help?</strong> Check out our <a href="https://unifyos.com/help" style="color: #059669; font-weight: 500;">Help Center</a> for quick answers to common questions.
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
              Best regards,<br>
              <strong>The UnifyOS Team</strong>
            </p>
            
            <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px;">
                UnifyOS - Automate Your Workflow<br>
                <a href="https://unifyos-platform.onrender.com" style="color: #2563eb;">unifyos-platform.onrender.com</a>
              </p>
            </div>
          </div>
        `,
      }),
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Support request sent successfully' 
    });
  } catch (error) {
    console.error('Support request error:', error);
    return res.status(500).json({ error: 'Failed to send support request' });
  }
}
