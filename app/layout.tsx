import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cookies } from 'next/headers';
import { LanguageProvider, type Locale } from '@/app/context/LanguageContext';
import { NotificationProvider } from '@/app/context/NotificationContext';
import { ToastProvider } from '@/app/context/ToastContext';
import SiteFooter from "@/app/components/SiteFooter";
import BottomTabNavigation from "@/app/components/mobile/BottomTabNavigation";
import ClientMainWrapper from '@/app/components/ClientMainWrapper';
import KakaoIabEscapeGate from '@/app/components/KakaoIabEscapeGate';
import Script from "next/script";
import QueryProvider from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/app/context/AuthContext';
import { ViewModeProvider, type ViewMode } from '@/app/context/ViewModeContext';
import { getCurrentLocale } from '@/app/utils/locale';
import { resolveDesktopFooterAdSlotConfig } from '@/app/utils/adsense';
import { shouldRenderVercelAnalytics } from '@/app/utils/analytics/runtime';
import { resolveGoogleAnalyticsConfig } from '@/app/utils/analytics/google';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl, getSiteUrl } from '@/app/utils/siteUrl';
import { IAB_ESCAPE_BYPASS_PARAM } from '@/app/utils/iab';
import { createClient } from '@/app/utils/supabase/server';
import { hasSupabaseSessionCookie } from '@/app/utils/supabase/authCookies';
import { Analytics } from "@vercel/analytics/react";
import { SplashProvider } from '@/app/context/SplashContext';
import GlobalSplash from '@/app/components/GlobalSplash';
import GlobalAnnouncementModal from '@/app/components/GlobalAnnouncementModal';
import DesktopFooterAdSlot from '@/app/components/DesktopFooterAdSlot';
import GoogleAnalyticsGate from '@/app/components/GoogleAnalyticsGate';
import InstagramIabPrompt from '@/app/components/InstagramIabPrompt';

const inter = localFont({
  src: [
    { path: "./fonts/Inter/Inter_18pt-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Inter/Inter_18pt-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Inter/Inter_18pt-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Inter/Inter_18pt-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-inter",
});

const ibmPlexSansKr = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-kr/IBMPlexSansKR-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/ibm-plex-sans-kr/IBMPlexSansKR-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-kr/IBMPlexSansKR-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-kr/IBMPlexSansKR-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-kr/IBMPlexSansKR-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-ibm-plex-sans-kr",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const siteUrl = getSiteUrl();
  const localizedHomeUrl = buildLocalizedAbsoluteUrl(locale);

  const titleMap: Record<string, string> = {
    ko: 'Locally - 현지인과 함께하는 특별한 여행',
    en: 'Locally - Unique Travel with Local Guides',
    ja: 'Locally - 現地の人と行く特別な旅',
    zh: 'Locally - 与当地人一起的特别旅行'
  };

  const descMap: Record<string, string> = {
    ko: '현지 호스트가 직접 기획하고 진행하는 로컬 체험을 예약하세요.',
    en: 'Book local experiences planned and hosted by locals.',
    ja: '現地ホストが直接企画・進行するローカル体験を予約しましょう。',
    zh: '预订由当地房东亲自策划并举办的本地体验活动。'
  };

  const siteNameMap: Record<string, string> = {
    ko: '로컬리 Locally',
    en: 'Locally',
    ja: 'ローカリー Locally',
    zh: 'Locally'
  };

  const title = titleMap[locale] || titleMap.ko;
  const description = descMap[locale] || descMap.ko;
  const siteName = siteNameMap[locale] || siteNameMap.ko;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      template: '%s | Locally',
      default: title,
    },
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: localizedHomeUrl,
      siteName: siteName,
      locale: locale === 'ko' ? 'ko_KR' : locale === 'ja' ? 'ja_JP' : locale === 'zh' ? 'zh_CN' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
    },
    keywords: ['여행', '현지인 가이드', '로컬 체험', '한국 여행', '서울 투어', '일본 동행', '일본 현지 가이드', '맞춤 의뢰', 'Locally'],
    alternates: {
      languages: {
        'ko': buildAbsoluteUrl('/'),
        'en': buildLocalizedAbsoluteUrl('en'),
        'ja': buildLocalizedAbsoluteUrl('ja'),
        'zh': buildLocalizedAbsoluteUrl('zh'),
      },
      canonical: localizedHomeUrl,
    }
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getCurrentLocale();
  const desktopFooterAdConfig = resolveDesktopFooterAdSlotConfig(process.env);
  const vercelAnalyticsEnabled = shouldRenderVercelAnalytics(process.env);
  const googleAnalyticsConfig = resolveGoogleAnalyticsConfig(process.env);
  const kakaoIabEscapeEnabled = process.env.NEXT_PUBLIC_ENABLE_KAKAO_IAB_ESCAPE === 'true';
  const cookieStore = await cookies();
  const initialViewModeCookie = cookieStore.get('locally_view_mode')?.value;
  const initialViewMode: ViewMode | null =
    initialViewModeCookie === 'host' || initialViewModeCookie === 'guest'
      ? initialViewModeCookie
      : null;
  const hasInitialSessionCookie = hasSupabaseSessionCookie(cookieStore.getAll());

  let initialUser = null;
  if (hasInitialSessionCookie) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    initialUser = user || null;
  }

  const kakaoIabBootstrapScript = `
    (() => {
      try {
        if (!${JSON.stringify(kakaoIabEscapeEnabled)}) return;
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get(${JSON.stringify(IAB_ESCAPE_BYPASS_PARAM)}) === '1') return;

        const userAgent = navigator.userAgent || '';
        if (!/KAKAOTALK/i.test(userAgent)) return;

        document.documentElement.dataset.iab = 'kakao';
        document.documentElement.dataset.iabLock = 'true';
        window.__LOCALLY_KAKAO_IAB__ = {
          detected: true,
          kind: 'kakao',
          currentUrl: window.location.href,
        };
      } catch {}
    })();
  `;

  return (
    <html lang={locale} suppressHydrationWarning={true}>
      <body className={`${inter.variable} ${ibmPlexSansKr.variable} font-sans`}>
        {kakaoIabEscapeEnabled && (
          <Script
            id="locally-kakao-iab-bootstrap"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: kakaoIabBootstrapScript }}
          />
        )}
        {process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY && (
          <Script
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services,clusterer&autoload=false`}
            strategy="beforeInteractive"
          />
        )}
        <KakaoIabEscapeGate enabled={kakaoIabEscapeEnabled} locale={locale} />
        <QueryProvider>
          <AuthProvider initialUser={initialUser} initialSessionResolved={true}>
            <ViewModeProvider initialViewMode={initialViewMode}>
              <ToastProvider>
                <NotificationProvider>
                  <LanguageProvider initialLocale={locale as Locale}>
                    <SplashProvider>
                      <GlobalSplash />
                      <GlobalAnnouncementModal />
                      <InstagramIabPrompt />

                      <div className="flex flex-col min-h-screen" id="locally-app-shell">
                        <ClientMainWrapper>
                          {children}
                        </ClientMainWrapper>
                        <SiteFooter />
                        <DesktopFooterAdSlot
                          clientId={desktopFooterAdConfig.clientId}
                          slotId={desktopFooterAdConfig.slotId}
                          enabled={desktopFooterAdConfig.enabled}
                        />
                        <BottomTabNavigation />
                      </div>
                      {vercelAnalyticsEnabled && <Analytics />}
                      <GoogleAnalyticsGate
                        enabled={googleAnalyticsConfig.enabled}
                        measurementId={googleAnalyticsConfig.measurementId}
                        cmpScriptUrl={googleAnalyticsConfig.cmpScriptUrl}
                        allowedHostname={googleAnalyticsConfig.allowedHostname}
                      />
                    </SplashProvider>
                  </LanguageProvider>
                </NotificationProvider>
              </ToastProvider>
            </ViewModeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
