import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker';
import { NotificationProvider } from '@/app/context/NotificationContext';
import { ToastProvider } from '@/app/context/ToastContext';
import SiteFooter from "@/app/components/SiteFooter";
import Script from "next/script"; // 🟢 외부 스크립트 에러 방지용

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locally",
  description: "Travel like a local",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* 🟢 suppressHydrationWarning: 날짜/시간 불일치 에러(#418) 방지 */
    <html lang="ko" suppressHydrationWarning={true}>
      <head>
        {/* 필요한 경우 카카오맵 스크립트 복구 (없으면 지도 에러남) */}
        {process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY && (
          <script 
            type="text/javascript" 
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services,clusterer`}
          ></script>
        )}
      </head>
      <body className={inter.className}>
        {/* 🟢 [핵심 수정] ToastProvider를 가장 바깥으로 뺐습니다! */}
        <ToastProvider>
          <NotificationProvider>
            <LanguageProvider>
              
              {/* 유저 상태 추적 */}
              <UserPresenceTracker />
              
              {/* 🟢 레이아웃 구조 개선 (푸터 하단 고정) */}
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