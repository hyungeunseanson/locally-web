import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext';
import UserPresenceTracker from '@/app/components/UserPresenceTracker';
import { NotificationProvider } from '@/app/context/NotificationContext'; // ✅ 절대 경로 확인

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
            <UserPresenceTracker /> 
            {children}
          </NotificationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}