import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en', 'ja', 'zh'],
  defaultLocale: 'ko',
  localePrefix: 'as-needed'
});

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. API 및 정적 파일 제외
  if (
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next') || 
    pathname.includes('.')
  ) {
    return await updateSession(request);
  }

  // 2. [강제 Rewrite] 파일 구조 없는 다국어 지원을 위한 핵심 로직
  // Vercel에서 /ja -> / 로 내부 연결이 안 될 때를 대비해 직접 연결
  // 예: /ja/experiences/123 -> /experiences/123 (locale 정보는 헤더로 전달됨)
  
  // 지원하는 언어 경로인지 확인
  const localeMatch = pathname.match(/^\/(ko|en|ja|zh)(\/|$)/);
  if (localeMatch) {
    const locale = localeMatch[1];
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';

    // next-intl 미들웨어를 실행하여 헤더 설정을 받음 (쿠키, x-middleware-rewrite 등)
    const response = intlMiddleware(request);

    // 강제로 Rewrite 설정 (현재 경로 -> 로케일 없는 실제 경로)
    // 중요: next-intl이 설정한 헤더는 유지하면서 목적지만 변경
    const rewriteUrl = new URL(pathWithoutLocale, request.url);
    
    // Supabase 세션 처리 및 Rewrite 적용
    const supabaseResponse = await updateSession(request, response);
    
    // 최종적으로 Rewrite 수행 (Supabase 처리가 끝난 response에 덮어씌우기보단, 
    // NextResponse.rewrite를 반환하되 헤더를 복사하는 방식이 안전)
    const finalResponse = NextResponse.rewrite(rewriteUrl);
    
    // 기존 헤더 복사 (x-middleware-request-id, set-cookie 등)
    supabaseResponse.headers.forEach((value, key) => {
      finalResponse.headers.set(key, value);
    });
    // 쿠키 복사
    supabaseResponse.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie);
    });
    
    // next-intl이 감지한 locale 정보를 헤더에 심어주기 (서버 컴포넌트용)
    finalResponse.headers.set('X-NEXT-INTL-LOCALE', locale);

    return finalResponse;
  }

  // 3. 기본 경로(/)인 경우
  const intlResponse = intlMiddleware(request);
  return await updateSession(request, intlResponse);
}

export const config = {
  matcher: ['/', '/(ko|en|ja|zh)/:path*', '/((?!_next|_vercel|.*\\..*).*)']
};
