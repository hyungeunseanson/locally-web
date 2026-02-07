import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker'; // ✅ 기존 기능 유지
import { NotificationProvider } from '@/app/context/NotificationContext'; // ✅ 알림 기능 추가

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
    <html lang="ko">
      <body className={inter.className}>
        <LanguageProvider>
          {/* 알림 기능을 언어 설정 하위에 배치 */}
          <NotificationProvider>
            {/* ✅ 사이트 방문 시 자동으로 접속자 집계 시작 (기존 기능 유지) */}
            <UserPresenceTracker /> 
            {children}
          </NotificationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}