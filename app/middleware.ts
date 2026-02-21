import { type NextRequest } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en', 'ja', 'zh'],
  defaultLocale: 'ko',
  localePrefix: 'as-needed'
});

export async function middleware(request: NextRequest) {
  // 1. API 및 내부 경로 제외 (가장 먼저 체크)
  const pathname = request.nextUrl.pathname;
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
  // next-intl이 Redirect를 시키는 경우(예: / -> /ko)에는 세션 업데이트 불필요할 수 있으나,
  // 안전하게 모든 경우에 세션을 유지하도록 함.
  const finalResponse = await updateSession(request, intlResponse);

  return finalResponse;
}

export const config = {
  // Matcher를 더 단순하고 강력하게 설정
  // 모든 경로를 잡되, 내부 로직에서 api 등을 제외하는 방식이 더 안전함
  matcher: ['/((?!_next|.*\\..*).*)']
};
