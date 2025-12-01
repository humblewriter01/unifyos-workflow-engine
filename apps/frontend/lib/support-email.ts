// apps/frontend/lib/support-email.ts
// SIMPLE VERSION - Just forwards to your personal email

export async function sendSupportEmailSimple(
  name: string,
  email: string,
  subject: string,
  message: string,
  category: string,
  userId?: string
) {
  try {
    // 1. Send to your personal email (ameenujaafar59@gmail.com)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UnifyOS Support <support@unifyos.com>',
        to: process.env.SUPPORT_EMAIL || 'ameenujaafar59@gmail.com',
        subject: `[UnifyOS Support] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Support Request from ${name}</h2>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>User ID:</strong> ${userId || 'Not logged in'}</p>
            <hr>
            <h3>${subject}</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><small>Received: ${new Date().toLocaleString()}</small></p>
            <p><small>Just reply to this email to respond to ${email}</small></p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send support email');
    }

    console.log(`Support email sent to ${process.env.SUPPORT_EMAIL}`);
    return { success: true };
  } catch (error) {
    console.error('Support email error:', error);
    throw error;
  }
}

// Even simpler - just the bare minimum
export async function sendToAmeenu(
  name: string,
  email: string,
  subject: string,
  message: string
) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'UnifyOS Support <support@unifyos.com>',
      to: 'ameenujaafar59@gmail.com',
      subject: `Support: ${subject}`,
      html: `<p>From: ${name} (${email})</p><p>${message}</p>`,
    }),
  });
}
