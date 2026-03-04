import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { Suspense } from "react";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker';
import { NotificationProvider } from '@/app/context/NotificationContext';
import { ToastProvider } from '@/app/context/ToastContext';
import SiteFooter from "@/app/components/SiteFooter";
import BottomTabNavigation from "@/app/components/mobile/BottomTabNavigation";
import ClientMainWrapper from '@/app/components/ClientMainWrapper';
import Script from "next/script";
import QueryProvider from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/app/context/AuthContext';
import { getCurrentLocale } from '@/app/utils/locale';
import { createClient } from '@/app/utils/supabase/server';
import type { User } from '@supabase/supabase-js';
import { Analytics } from "@vercel/analytics/react";

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
  const headersList = await headers();
  const locale = headersList.get('x-locally-locale') || 'ko';

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
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://locally.vercel.app'),
    title: {
      template: '%s | Locally',
      default: title,
    },
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: 'https://locally.vercel.app',
      siteName: siteName,
      images: [
        {
          url: 'https://cdn.imweb.me/thumbnail/20251114/7d271dc71e667.png',
          width: 1200,
          height: 630,
          alt: 'Locally Hero Image',
        },
      ],
      locale: locale === 'ko' ? 'ko_KR' : locale === 'ja' ? 'ja_JP' : locale === 'zh' ? 'zh_CN' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: ['https://cdn.imweb.me/thumbnail/20251114/7d271dc71e667.png'],
    },
    keywords: ['여행', '현지인 가이드', '로컬 체험', '한국 여행', '서울 투어', '일본 동행', '일본 현지 가이드', '맞춤 의뢰', 'Locally'],
    alternates: {
      languages: {
        'ko': 'https://locally.vercel.app/ko',
        'en': 'https://locally.vercel.app/en',
        'ja': 'https://locally.vercel.app/ja',
        'zh': 'https://locally.vercel.app/zh',
      },
      canonical: locale === 'ko' ? 'https://locally.vercel.app' : `https://locally.vercel.app/${locale}`
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

  // 🟢 [M-3] 서버 사이드에서 세션 가져오기 (FOUC 방지)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 프로필 이미지까지 가져와서 주입하면 완벽합니다.
  let initialUser = user || null;
  if (initialUser) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', initialUser.id)
      .maybeSingle();
    if (profile?.avatar_url) {
      initialUser = {
        ...initialUser,
        user_metadata: {
          ...initialUser.user_metadata,
          avatar_url: profile.avatar_url
        }
      } as User;
    }
  }

  return (
    <html lang={locale} suppressHydrationWarning={true}>
      <body className={`${inter.variable} ${ibmPlexSansKr.variable} font-sans`}>
        {process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY && (
          <Script
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services,clusterer&autoload=false`}
            strategy="beforeInteractive"
          />
        )}
        <QueryProvider>
          <AuthProvider initialUser={initialUser}>
            <ToastProvider>
              <NotificationProvider>
                <LanguageProvider>

                  <Suspense fallback={null}>
                    <UserPresenceTracker />
                  </Suspense>

                  <div className="flex flex-col min-h-screen">
                    <ClientMainWrapper>
                      {children}
                    </ClientMainWrapper>
                    <SiteFooter />
                    <BottomTabNavigation />
                  </div>
                  <Analytics />
                </LanguageProvider>
              </NotificationProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
