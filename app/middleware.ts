import { type NextRequest } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en', 'ja', 'zh'],
  defaultLocale: 'ko',
  localePrefix: 'as-needed'
});

export async function middleware(request: NextRequest) {
  // 1. API 및 정적 파일 제외 (가장 먼저 체크)
  const pathname = request.nextUrl.pathname;
  
  // 디버깅용 헤더 설정 (배포 후 확인용)
  request.headers.set('x-middleware-path', pathname);

  if (
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next') || 
    pathname.includes('.') // 파일 확장자가 있는 경우 (이미지, 파비콘 등)
  ) {
    return await updateSession(request);
  }

  // 2. next-intl 미들웨어 실행 (Response 생성 - Rewrite/Redirect 담당)
  const intlResponse = intlMiddleware(request);

  // 3. 생성된 Response를 Supabase 미들웨어에 전달
  const finalResponse = await updateSession(request, intlResponse);

  return finalResponse;
}

export const config = {
  // Matcher: 루트(/)와 모든 경로를 포함하되, 내부 경로 제외
  matcher: ['/', '/(ko|en|ja|zh)/:path*', '/((?!_next|_vercel|.*\\..*).*)']
};
