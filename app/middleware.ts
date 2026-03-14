import { NextRequest } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // API 및 정적 파일 제외
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return await updateSession(request);
  }

  // 1. URL Path에서 locale 추출 (ko|en|ja|zh)
  const localeMatch = pathname.match(/^\/(ko|en|ja|zh)(\/|$)/);

  // 2. 헤더 복사 — URL prefix 있을 때만 주입
  // prefix 없으면 헤더 미주입 → locale.ts가 cookie → Accept-Language 순으로 자연스럽게 처리
  const requestHeaders = new Headers(request.headers);
  if (localeMatch) {
    requestHeaders.set('x-locally-locale', localeMatch[1]);
  }

  // 3. 조작된 헤더를 지닌 request 껍데기를 만들어 하위 로직(updateSession)으로 패스
  const modifiedRequest = new NextRequest(request, {
    headers: requestHeaders,
  });

  // Supabase 세션 처리 및 헤더 병합
  const finalResponse = await updateSession(modifiedRequest);

  return finalResponse;
}

export const config = {
  matcher: ['/', '/(ko|en|ja|zh)/:path*', '/((?!_next|_vercel|.*\\..*).*)']
};
