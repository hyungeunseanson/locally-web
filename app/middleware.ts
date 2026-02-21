import { type NextRequest } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en', 'ja', 'zh'],
  defaultLocale: 'ko',
  localePrefix: 'as-needed'
});

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

  // next-intl 미들웨어 실행
  const intlResponse = intlMiddleware(request);

  // Supabase 세션 처리 및 헤더 병합
  const finalResponse = await updateSession(request, intlResponse);

  return finalResponse;
}

export const config = {
  matcher: ['/', '/(ko|en|ja|zh)/:path*', '/((?!_next|_vercel|.*\\..*).*)']
};
