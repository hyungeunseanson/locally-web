import type { Metadata } from "next";
import { Inter } from "next/font/google"; // ✅ 파일 필요 없는 구글 폰트 사용
import "./globals.css";
import { LanguageProvider } from '@/app/context/LanguageContext';

// ✅ Inter 폰트 설정 (GeistVF 대체)
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
      <body className={inter.className}> {/* ✅ 폰트 적용 */}
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}