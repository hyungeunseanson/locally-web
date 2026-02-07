import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker'; // ✅ 추가됨
import { NotificationProvider } from './context/NotificationContext'; 

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <NotificationProvider> {/* ✅ 여기 감싸주세요 */}
           {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
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
          {/* ✅ 사이트 방문 시 자동으로 접속자 집계 시작 */}
          <UserPresenceTracker /> 
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}