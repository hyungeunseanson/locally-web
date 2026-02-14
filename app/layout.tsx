import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker';
import { NotificationProvider } from '@/app/context/NotificationContext';
import { ToastProvider } from '@/app/context/ToastContext';
import SiteFooter from "@/app/components/SiteFooter";
import Script from "next/script"; // 🟢 Script 컴포넌트 사용

const inter = Inter({ subsets: ["latin"] });

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning={true}>
      {/* 🟢 [수정] head 태그 삭제함 (Next.js에서는 불필요) */}
      
      <body className={inter.className}>
        {/* 🟢 [수정] 카카오맵 스크립트를 body 안으로 옮기고 Script 컴포넌트 사용 */}
        {process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY && (
          <Script 
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services,clusterer&autoload=false`}
            strategy="beforeInteractive" 
          />
        )}

        <ToastProvider>
          <NotificationProvider>
            <LanguageProvider>
              <UserPresenceTracker />
              <div className="flex flex-col min-h-screen">
                <main className="flex-1">
                  {children}
                </main>
                <SiteFooter />
              </div>
            </LanguageProvider>
          </NotificationProvider>
        </ToastProvider>
      </body>
    </html>
  );
}