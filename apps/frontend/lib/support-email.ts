// apps/frontend/lib/support-email.ts
// SIMPLE VERSION - Uses environment variable

export async function sendSupportEmail(
  name: string,
  email: string,
  subject: string,
  message: string,
  category: string,
  userId?: string
) {
  try {
    // Get support email from environment variable
    const supportEmail = process.env.SUPPORT_EMAIL;
    
    if (!supportEmail) {
      throw new Error('SUPPORT_EMAIL environment variable is not set');
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    // Send to support email from environment variable
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UnifyOS Support <support@unifyos.com>',
        to: supportEmail, // ← From environment variable
        subject: `[UnifyOS Support] ${category}: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Support Request from ${name}</h2>
            <p><strong>User Email:</strong> ${email}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>User ID:</strong> ${userId || 'Not logged in'}</p>
            <hr>
            <h3>${subject}</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><small>Received: ${new Date().toLocaleString()}</small></p>
            <p><small>Reply to this email to respond to ${email}</small></p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send support email');
    }

    console.log(`✅ Support email sent to ${supportEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Support email error:', error);
    throw error;
  }
}
