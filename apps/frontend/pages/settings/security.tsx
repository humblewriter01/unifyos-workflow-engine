import { FormEvent, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { AlertCircle, CheckCircle, Copy, KeyRound, Loader2, Lock, Shield, Smartphone } from 'lucide-react';

type Message = { type: 'success' | 'error'; text: string } | null;

export default function SecuritySettings() {
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0);
  const [setup, setSetup] = useState<{ qrCodeDataUrl: string; manualKey: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState('');

  const loadTwoFactorStatus = async () => {
    try {
      const response = await fetch('/api/user/2fa/status');
      if (!response.ok) return;
      const data = await response.json();
      setTwoFactorEnabled(Boolean(data.enabled));
      setRecoveryCodesRemaining(Number(data.recoveryCodesRemaining || 0));
    } catch {
      // The protected page remains usable if the status request is temporarily unavailable.
    }
  };

  useEffect(() => {
    void loadTwoFactorStatus();
  }, []);

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update password.');
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch('/api/user/2fa/setup', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start authenticator setup.');
      setSetup({ qrCodeDataUrl: data.qrCodeDataUrl, manualKey: data.manualKey });
      setVerificationCode('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to start authenticator setup.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch('/api/user/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to enable two-factor authentication.');
      setTwoFactorEnabled(true);
      setRecoveryCodesRemaining(data.recoveryCodes.length);
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setVerificationCode('');
      setMessage({ type: 'success', text: 'Two-factor authentication is enabled. Save your recovery codes now.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to enable two-factor authentication.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch('/api/user/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to disable two-factor authentication.');
      setTwoFactorEnabled(false);
      setRecoveryCodesRemaining(0);
      setDisableCode('');
      setMessage({ type: 'success', text: 'Two-factor authentication has been disabled.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to disable two-factor authentication.' });
    } finally {
      setLoading(false);
    }
  };

  const copyRecoveryCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setMessage({ type: 'success', text: 'Recovery codes copied to the clipboard.' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-neutral-200 dark:border-dark-700 pb-5">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Security Settings</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Manage your password and authenticator security.</p>
        </div>

        {message && <div role="alert" className={`p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>{message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}<p className="text-sm">{message.text}</p></div>}

        <section className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center"><Lock className="w-5 h-5 text-primary-600" /></div><div><h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Change password</h2><p className="text-sm text-neutral-600 dark:text-neutral-400">Use a strong password you do not reuse elsewhere.</p></div></div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <input type="password" autoComplete="current-password" placeholder="Current password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg text-neutral-900 dark:text-white" />
            <input type="password" autoComplete="new-password" placeholder="New password (8–128 characters)" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required minLength={8} maxLength={128} className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg text-neutral-900 dark:text-white" />
            <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required minLength={8} maxLength={128} className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg text-neutral-900 dark:text-white" />
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50">{loading ? 'Updating…' : 'Update password'}</button>
          </form>
        </section>

        <section className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center"><Smartphone className="w-5 h-5 text-purple-600" /></div><div><h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Authenticator app</h2><p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Use Google Authenticator, 1Password, Authy, or another TOTP app when signing in.</p><div className={`inline-flex mt-3 items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}><span className={`w-2 h-2 rounded-full ${twoFactorEnabled ? 'bg-emerald-500' : 'bg-neutral-400'}`} />{twoFactorEnabled ? 'Enabled' : 'Not enabled'}</div></div></div>{!twoFactorEnabled && !setup && <button type="button" onClick={handleSetup} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{loading ? 'Preparing…' : 'Set up 2FA'}</button>}{twoFactorEnabled && <span className="text-sm text-neutral-500">{recoveryCodesRemaining} recovery codes left</span>}</div>

          {setup && !twoFactorEnabled && <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-dark-700 grid md:grid-cols-2 gap-6"><div className="text-center"><p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-3">Scan this QR code</p><img src={setup.qrCodeDataUrl} alt="Authenticator setup QR code" className="w-56 h-56 mx-auto rounded-lg border border-neutral-200 p-2" /><p className="text-xs text-neutral-500 mt-3">Or enter this key manually: <code className="break-all">{setup.manualKey}</code></p></div><form onSubmit={handleEnable} className="space-y-4"><label htmlFor="setup-code" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Enter the 6-digit code from your app</label><input id="setup-code" inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required pattern="[0-9]{6}" maxLength={6} className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg text-neutral-900 dark:text-white" placeholder="123456" /><button type="submit" disabled={loading} className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50">{loading ? 'Verifying…' : 'Verify and enable'}</button></form></div>}

          {recoveryCodes.length > 0 && <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-lg"><div className="flex items-start gap-3"><KeyRound className="w-5 h-5 text-amber-700 flex-shrink-0" /><div className="flex-1"><h3 className="font-semibold text-amber-900">Save your recovery codes</h3><p className="text-sm text-amber-800 mt-1">Each code can be used once if you lose access to your authenticator. This is the only time they are shown.</p><div className="grid grid-cols-2 gap-2 mt-4 font-mono text-sm text-amber-950">{recoveryCodes.map((code) => <code key={code} className="bg-white/70 px-2 py-1 rounded">{code}</code>)}</div><button type="button" onClick={() => void copyRecoveryCodes()} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-900"><Copy className="w-4 h-4" />Copy codes</button></div></div></div>}

          {twoFactorEnabled && <form onSubmit={handleDisable} className="mt-6 pt-6 border-t border-neutral-200 dark:border-dark-700"><label htmlFor="disable-code" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Enter your current authenticator or recovery code to disable 2FA</label><div className="flex gap-3"><input id="disable-code" value={disableCode} onChange={(event) => setDisableCode(event.target.value)} required className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-dark-700 border border-neutral-300 dark:border-dark-600 rounded-lg text-neutral-900 dark:text-white" placeholder="123456 or recovery code" /><button type="submit" disabled={loading} className="px-4 py-2.5 border border-red-300 text-red-700 rounded-lg font-medium disabled:opacity-50">Disable 2FA</button></div></form>}
        </section>

        <section className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-lg p-6"><div className="flex items-center gap-3"><Shield className="w-5 h-5 text-orange-600" /><div><h2 className="font-semibold text-neutral-900 dark:text-white">Security note</h2><p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">If you lose both your authenticator and recovery codes, contact support before disabling access controls.</p></div></div></section>
      </div>
    </DashboardLayout>
  );
}
