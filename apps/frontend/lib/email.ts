// apps/frontend/lib/email.ts
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for email logs (optional)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Email templates
const emailTemplates = {
  verification: {
    subject: 'Verify your UnifyOS account',
    html: (verificationLink: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to UnifyOS! 🚀</h1>
        <p>Please verify your email address to start automating your workflows.</p>
        <a href="${verificationLink}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email Address
        </a>
        <p style="margin-top: 20px; color: #6b7280;">
          Or copy and paste this link in your browser:<br/>
          <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px;">
            ${verificationLink}
          </code>
        </p>
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          This link expires in 24 hours.
        </p>
      </div>
    `,
  },
  
  passwordReset: {
    subject: 'Reset your UnifyOS password',
    html: (resetLink: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Reset your password</h1>
        <p>You requested to reset your password. Click the button below to create a new one.</p>
        <a href="${resetLink}" 
           style="background-color: #dc2626; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
          This link will expire in 1 hour.<br/>
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  },
  
  welcome: {
    subject: 'Welcome to UnifyOS!',
    html: (userName: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to UnifyOS, ${userName}! 🎉</h1>
        <p>Your account is now ready. Start automating your workflows today.</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">Getting Started:</h3>
          <ul style="color: #475569;">
            <li>Connect your first app integration</li>
            <li>Create your first workflow automation</li>
            <li>Invite your team members</li>
          </ul>
        </div>
        <a href="https://unifyos-platform.onrender.com/dashboard" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Go to Dashboard
        </a>
      </div>
    `,
  },
};

// Main email sending function using Resend.com
export async function sendEmail(to: string, subject: string, html: string, metadata?: any) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'UnifyOS <onboarding@resend.dev>',
        to,
        subject,
        html,
        tags: [
          {
            name: 'category',
            value: 'authentication',
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Resend API error: ${error.message}`);
    }

    const data = await response.json();
    
    // Log email to Supabase (optional)
    try {
      await supabase.from('email_logs').insert({
        to_email: to,
        subject,
        status: 'sent',
        provider: 'resend',
        provider_id: data.id,
        metadata,
        sent_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.warn('Failed to log email to Supabase:', logError);
    }

    console.log(`✅ Email sent to ${to}: ${data.id}`);
    return data;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    
    // Log failure to Supabase
    try {
      await supabase.from('email_logs').insert({
        to_email: to,
        subject,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata,
        attempted_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.warn('Failed to log email error:', logError);
    }
    
    throw error;
  }
}

// Specific email functions
export async function sendVerificationEmail(email: string, userId: string) {
  const verificationLink = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${userId}`;
  
  return sendEmail(
    email,
    emailTemplates.verification.subject,
    emailTemplates.verification.html(verificationLink),
    { type: 'verification', userId }
  );
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;
  
  return sendEmail(
    email,
    emailTemplates.passwordReset.subject,
    emailTemplates.passwordReset.html(resetLink),
    { type: 'password_reset', token: resetToken }
  );
}

export async function sendWelcomeEmail(email: string, userName: string) {
  return sendEmail(
    email,
    emailTemplates.welcome.subject,
    emailTemplates.welcome.html(userName),
    { type: 'welcome', userName }
  );
}

// Test function
export async function testEmailService() {
  try {
    const testEmail = process.env.ADMIN_EMAIL || 'test@example.com';
    console.log('Testing email service...');
    
    const result = await sendEmail(
      testEmail,
      'UnifyOS Email Service Test',
      '<h1>Test Email</h1><p>If you receive this, email service is working!</p>',
      { type: 'test' }
    );
    
    console.log('✅ Email service test passed:', result);
    return true;
  } catch (error) {
    console.error('❌ Email service test failed:', error);
    return false;
  }
}
