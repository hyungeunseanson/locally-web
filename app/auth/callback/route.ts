import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { normalizeInternalReturnPath, resolveAuthCallbackOrigin } from '@/app/utils/authRedirect';
import { validatedRecoveryIdentity, issueRecoveryGrant, recoveryCookieOptions, clearRecoveryCookie } from '@/app/utils/passwordRecovery.server';
import { RECOVERY_COOKIE_NAME } from '@/app/utils/passwordReset';
import { ensureDemographicsReminder } from '@/app/utils/demographicsReminder';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // [Security] next는 반드시 상대경로 "/" 시작이어야 함 — 외부 도메인 오픈 리다이렉트 방지
  const recovery = searchParams.get('flow') === 'recovery';
  const normalizedNext = normalizeInternalReturnPath(searchParams.get('next'));
  const next = recovery ? '/auth/update-password' : normalizedNext;
  const redirect = (path: string) => {
    const response = NextResponse.redirect(`${redirectOrigin}${path}`);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    clearRecoveryCookie(response);
    return response;
  };
  const redirectOrigin = resolveAuthCallbackOrigin(request.url, request.headers);

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && (!recovery || data.session)) {
        if (recovery && data.session) {
          const identity = await validatedRecoveryIdentity(supabase, data.session);
          if (!identity) return redirect('/auth/forgot-password?invalid=1');
          const grant = issueRecoveryGrant(identity);
          const response = redirect(next);
          response.cookies.set(RECOVERY_COOKIE_NAME, grant.value, { ...recoveryCookieOptions, maxAge: grant.maxAge });
          return response;
        }
        const userId = data.session?.user?.id;
        if (userId && !recovery) {
          try {
            await ensureDemographicsReminder(userId);
          } catch {
            console.warn('[auth/callback] demographics reminder delivery failed');
          }
        }
        return redirect(next);
      }
    } catch {
      // Do not log authentication codes or raw provider errors.
    }
  }

  // 실패 시 에러 페이지로 이동
  return redirect(recovery ? '/auth/forgot-password?invalid=1' : '/auth/auth-code-error');
}
