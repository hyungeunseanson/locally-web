import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { normalizeInternalReturnPath, resolveAuthCallbackOrigin } from '@/app/utils/authRedirect';
import { ensureDemographicsReminder } from '@/app/utils/demographicsReminder';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // [Security] next는 반드시 상대경로 "/" 시작이어야 함 — 외부 도메인 오픈 리다이렉트 방지
  const next = normalizeInternalReturnPath(searchParams.get('next'));
  const redirectOrigin = resolveAuthCallbackOrigin(request.url, request.headers);

  if (code) {
    // 🟢 [수정됨] 복잡한 설정 코드 삭제 -> 유틸리티 함수 한 줄로 대체
    const supabase = await createClient();

    // 인증 코드 교환 (세션 생성)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const userId = data.session?.user?.id;
      if (userId) {
        try {
          await ensureDemographicsReminder(userId);
        } catch {
          console.warn('[auth/callback] demographics reminder delivery failed');
        }
      }
      // 성공 시 원래 가려던 페이지로 이동
      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  // 실패 시 에러 페이지로 이동
  return NextResponse.redirect(`${redirectOrigin}/auth/auth-code-error`);
}
