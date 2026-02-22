import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google"; // 🟢 폰트 변경
import "./globals.css";
import { Suspense } from "react";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker';
import { NotificationProvider } from '@/app/context/NotificationContext';
import { ToastProvider } from '@/app/context/ToastContext';
import SiteFooter from "@/app/components/SiteFooter";
import BottomTabNavigation from "@/app/components/mobile/BottomTabNavigation";
import Script from "next/script";
import QueryProvider from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/app/context/AuthContext';
import { getCurrentLocale } from '@/app/utils/locale';
import { createClient } from '@/app/utils/supabase/server';

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-noto-sans',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Locally',
    default: 'Locally - 현지인과 함께하는 특별한 여행',
  },
  description: "현지 호스트가 직접 기획하고 진행하는 로컬 체험을 예약하세요.",
  openGraph: {
    title: 'Locally - 현지인과 함께하는 특별한 여행',
    description: '현지 호스트가 직접 기획하고 진행하는 로컬 체험을 예약하세요.',
    url: 'https://locally.vercel.app',
    siteName: '로컬리 Locally',
    images: [
      {
        url: 'https://cdn.imweb.me/thumbnail/20251114/7d271dc71e667.png',
        width: 1200,
        height: 630,
        alt: 'Locally Hero Image',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Locally - 현지인과 함께하는 특별한 여행',
    description: '현지 호스트가 직접 기획하고 진행하는 로컬 체험을 예약하세요.',
    images: ['https://cdn.imweb.me/thumbnail/20251114/7d271dc71e667.png'],
  },
  keywords: ['여행', '현지인 가이드', '로컬 체험', '한국 여행', '서울 투어', 'Locally'],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getCurrentLocale();

  // 🟢 [M-3] 서버 사이드에서 세션 가져오기 (FOUC 방지)
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // 프로필 이미지까지 가져와서 주입하면 완벽합니다.
  let initialUser = session?.user || null;
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
      } as any;
    }
  }

  return (
    <html lang={locale} suppressHydrationWarning={true}>
      <body className={`${notoSansKr.className} ${notoSansKr.variable} font-sans`}>
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
                    <main className="flex-1 pb-20 md:pb-0">
                      {children}
                    </main>
                    <SiteFooter />
                    <BottomTabNavigation />
                  </div>

                </LanguageProvider>
              </NotificationProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
