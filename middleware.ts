import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// The locale rewrite selects a page; this Edge middleware carries the URL
// locale into its server render. It never inspects or refreshes auth sessions.
export function middleware(request: NextRequest) {
  const locale = request.nextUrl.pathname.split('/')[1];
  if (!['ko', 'en', 'ja', 'zh'].includes(locale)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locally-locale', locale);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set('app_lang', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  matcher: ['/(ko|en|ja|zh)/:path*'],
};
