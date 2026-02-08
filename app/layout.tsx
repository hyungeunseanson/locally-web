import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker';
import { NotificationProvider } from '@/app/context/NotificationContext'; // ✅ 절대 경로 확인
import { ToastProvider } from '@/app/context/ToastContext'; // ✅ 추가
import SiteFooter from "@/app/components/SiteFooter";

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
        <NotificationProvider>
            <ToastProvider> {/* ✅ 감싸기 */}
              <UserPresenceTracker /> 
              {children}
              <SiteFooter />
            </ToastProvider>
          </NotificationProvider>
        </LanguageProvider>

        {/* 👇 [2. 필수] 여기에 넣으면 모든 페이지 바닥에 붙습니다! */}
       
      </body>
    </html>
  );
}