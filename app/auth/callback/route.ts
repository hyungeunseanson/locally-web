import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server'; // 🟢 만들어둔 유틸리티 사용

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // "next" 파라미터가 있으면 거기로, 없으면 홈(/)으로 이동
  const next = searchParams.get('next') ?? '/';

  if (code) {
    // 🟢 [수정됨] 복잡한 설정 코드 삭제 -> 유틸리티 함수 한 줄로 대체
    const supabase = await createClient();
    
    // 인증 코드 교환 (세션 생성)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // 성공 시 원래 가려던 페이지로 이동
      const forwardedHost = request.headers.get('x-forwarded-host'); // 로드 밸런서 고려
      const isLocalEnv = process.env.NODE_ENV === 'development';
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // 실패 시 에러 페이지로 이동
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}