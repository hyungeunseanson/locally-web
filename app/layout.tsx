import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext'; // ✅ 추가

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

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
      <body className={`${geistSans.variable} antialiased`}>
        {/* ✅ Provider로 감싸기 */}
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}