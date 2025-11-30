// apps/frontend/pages/auth/verify-email.tsx
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { token, email } = router.query;
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-verify if token is in URL
  useEffect(() => {
    if (token && typeof token === 'string') {
      verifyWithToken(token);
    }
  }, [token]);

  const verifyWithToken = async (verificationToken: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every(digit => digit) && newCode.join('').length === 6) {
      verifyWithCode(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setCode(newCode);

    if (pastedData.length === 6) {
      verifyWithCode(pastedData);
    }
  };

  const verifyWithCode = async (verificationCode: string) => {
    setLoading(true);
    setError('');

    try {
      // Get userId from localStorage (set during signup)
      const userId = localStorage.getItem('unifyos_pending_verification');

      if (!userId) {
        throw new Error('Verification session expired. Please request a new code.');
      }

      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setSuccess(true);
      localStorage.removeItem('unifyos_pending_verification');
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err: any) {
      setError(err.message);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    setError('');

    try {
      const verificationEmail = email || localStorage.getItem('unifyos_verification_email');

      if (!verificationEmail) {
        throw new Error('Email not found. Please sign up again.');
      }

      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Email Verified!
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Your account is now active. Redirecting to login...
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 text-primary-600 dark:text-primary-400 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl shadow-lg mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Check your email</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            We sent a 6-digit code to {email || 'your email'}
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-dark-700 p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Success Message for Resend */}
          {resendSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                New verification code sent!
              </p>
            </div>
          )}

          {/* Code Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4 text-center">
              Enter verification code
            </label>
            <div className="flex justify-center space-x-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleCodeChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={loading}
                  className="w-12 h-14 text-center text-2xl font-bold bg-neutral-50 dark:bg-dark-700 border-2 border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent text-neutral-900 dark:text-white disabled:opacity-50"
                />
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center space-x-2 text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying...</span>
            </div>
          )}

          {/* Resend Code */}
          <div className="text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              Didn't receive the code?
            </p>
            <button
              onClick={handleResendCode}
              disabled={resendLoading}
              className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading ? 'Sending...' : 'Resend code'}
            </button>
          </div>

          {/* Back to Login */}
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-dark-700 text-center">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              ← Back to login
            </Link>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <p>Check your spam folder if you don't see the email</p>
        </div>
      </div>
    </div>
  );
}
