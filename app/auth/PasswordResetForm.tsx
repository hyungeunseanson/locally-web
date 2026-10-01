'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { getLoginModalCopy } from '@/app/components/loginModalLocalization';
import { getPasswordResetCopy } from '@/app/components/passwordResetLocalization';
import { createClient } from '@/app/utils/supabase/client';
import { buildPasswordRecoveryRedirect, SIGNUP_PASSWORD_MIN_LENGTH } from '@/app/utils/passwordReset';

export default function PasswordResetForm({ mode }: { mode: 'request' | 'update' | 'invalid' }) {
  const { t, lang } = useLanguage();
  const copy = getPasswordResetCopy(lang);
  const authCopy = getLoginModalCopy(lang);
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState(mode === 'invalid');
  const [changed, setChanged] = useState(false);
  const [cleanedUp, setCleanedUp] = useState(false);

  async function cleanupSession() {
    // Explicit local scope avoids signing out other devices. The SDK also
    // removes local state when the session has already ended (401/403/404).
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      setCleanedUp(!error);
      setMessage(error ? copy.cleanupFailed : copy.success);
    } catch {
      setMessage(copy.cleanupFailed);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || invalid || changed) return;
    if (mode === 'update') {
      if (password !== confirmation) {
        setMessage(authCopy.passwordMismatch);
        return;
      }
      if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
        setMessage(t('password_min_hint'));
        return;
      }
    }
    submitting.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'request') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: buildPasswordRecoveryRedirect(window.location.origin),
        });
        // Never display provider errors or account-specific details.
        setMessage(error?.status === 429 ? copy.retryLater : copy.sent);
        setEmail('');
      } else {
        // Revalidate with Auth immediately before updating; neither a query
        // parameter nor a locally cached session authorizes a password change.
        const { data, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !data.user) {
          setInvalid(true);
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          if ([401, 403].includes(error.status ?? 0)) setInvalid(true);
          else setMessage(copy.updateFailed);
          return;
        }
        setChanged(true);
        await cleanupSession();
      }
    } catch {
      setMessage(mode === 'request' ? copy.retryLater : copy.updateFailed);
    } finally {
      setPassword('');
      setConfirmation('');
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold">{mode === 'request' ? copy.title : copy.updateTitle}</h1>
        {invalid ? (
          <>
            <p role="alert" className="mb-4">{copy.invalid}</p>
            <Link href="/auth/forgot-password" prefetch={false} className="font-semibold underline">{copy.requestAgain}</Link>
          </>
        ) : changed ? (
          <>
            <p role="status" className="mb-4">{message}</p>
            {cleanedUp ? (
              <a href="/login" className="font-semibold underline">{copy.finish}</a>
            ) : (
              <button type="button" disabled={busy} onClick={async () => {
                setBusy(true);
                await cleanupSession();
                setBusy(false);
              }} className="font-semibold underline disabled:opacity-50">{copy.finish}</button>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'request' ? (
              <>
                <p className="text-sm text-slate-600">{copy.description}</p>
                <label className="block">{t('email')}
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 block w-full rounded-lg border p-3" />
                </label>
              </>
            ) : (
              <>
                <label className="block">{copy.newPassword}
                  <input type="password" required minLength={SIGNUP_PASSWORD_MIN_LENGTH} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 block w-full rounded-lg border p-3" />
                </label>
                <label className="block">{authCopy.passwordConfirmLabel}
                  <input type="password" required minLength={SIGNUP_PASSWORD_MIN_LENGTH} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-2 block w-full rounded-lg border p-3" />
                </label>
                <p className="text-sm text-slate-500">{t('password_min_hint')}</p>
              </>
            )}
            {message && <p role="status">{message}</p>}
            <button disabled={busy} type="submit" className="w-full rounded-lg bg-slate-900 p-3 font-semibold text-white disabled:opacity-50">{mode === 'request' ? copy.send : copy.update}</button>
          </form>
        )}
        {!changed && <Link href="/login" prefetch={false} className="mt-6 block text-sm underline">{t('login')}</Link>}
      </div>
    </main>
  );
}
