import { type NextRequest } from 'next/server';
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

  // Supabase 세션 처리 및 헤더 병합
  const finalResponse = await updateSession(request);

  return finalResponse;
}

export const config = {
  matcher: ['/', '/(ko|en|ja|zh)/:path*', '/((?!_next|_vercel|.*\\..*).*)']
};
