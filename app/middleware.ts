import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';
import { hasSupabaseSessionCookie } from '@/app/utils/supabase/authCookies';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

function extractLocaleFromPathname(pathname: string): Locale | null {
  const match = pathname.match(/^\/(ko|en|ja|zh)(\/|$)/);
  return match ? (match[1] as Locale) : null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const originalPathname = new URL(request.url).pathname;
  const hasSessionCookie = hasSupabaseSessionCookie(request.cookies.getAll());

  // API 및 정적 파일 제외
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 1. URL Path에서 locale 추출 (ko|en|ja|zh)
  // next.config rewrites가 prefix를 제거할 수 있으므로 original request URL을 우선 사용한다.
  const resolvedLocale =
    extractLocaleFromPathname(originalPathname) ||
    extractLocaleFromPathname(pathname);
  const shouldRefreshHostLandingLocaleCookie =
    Boolean(resolvedLocale) &&
    /^\/(ko|en|ja|zh)\/become-a-host(\/|$)/.test(originalPathname) &&
    request.cookies.get('app_lang')?.value !== resolvedLocale;

  if (shouldRefreshHostLandingLocaleCookie && resolvedLocale) {
    const redirectResponse = NextResponse.redirect(
      new URL(`${originalPathname}${request.nextUrl.search}`, request.url)
    );
    redirectResponse.cookies.set('app_lang', resolvedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return hasSessionCookie ? await updateSession(request, redirectResponse) : redirectResponse;
  }

  if (!resolvedLocale && !hasSessionCookie) {
    return NextResponse.next();
  }

  // 2. 헤더 복사 — URL prefix 있을 때만 주입
  // prefix 없으면 헤더 미주입 → locale.ts가 cookie → Accept-Language 순으로 자연스럽게 처리
  const requestHeaders = new Headers(request.headers);
  if (resolvedLocale) {
    requestHeaders.set('x-locally-locale', resolvedLocale);
  }

  const downstreamResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const finalResponse = hasSessionCookie
    ? await updateSession(request, downstreamResponse)
    : downstreamResponse;

  if (!resolvedLocale) {
    return finalResponse;
  }

  finalResponse.cookies.set('app_lang', resolvedLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return finalResponse;
}

export const config = {
  matcher: ['/', '/(ko|en|ja|zh)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
