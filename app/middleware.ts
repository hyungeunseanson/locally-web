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
  if (request.nextUrl.pathname.startsWith('/api') || request.nextUrl.pathname.startsWith('/_next')) {
    return await updateSession(request);
  }

  // 1. next-intl 미들웨어 실행 (Response 생성)
  const intlResponse = intlMiddleware(request);

  // 2. 생성된 Response를 Supabase 미들웨어에 전달하여 세션 처리 및 쿠키 병합
  // 이렇게 하면 next-intl의 rewrite 헤더와 Supabase의 auth 쿠키가 하나의 Response에 담김
  const finalResponse = await updateSession(request, intlResponse);

  return finalResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
