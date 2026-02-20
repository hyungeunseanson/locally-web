'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: any;
  }
}

const GoogleTranslate = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'ko', 
          includedLanguages: 'ko,en,ja,zh-CN,vi,th',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
      }
    };
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
      
      <div className="fixed bottom-10 right-10 z-[9999]">
        <div className="relative w-[140px] h-[48px] group">
          
          {/* 1. 디자인 레이어: pointer-events-none으로 클릭 방해 원천 차단 */}
          <div className="absolute inset-0 pointer-events-none select-none">
            {/* 배경 글로우 */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-700 animate-pulse-slow"></div>
            
            {/* 메인 버튼 바디 */}
            <div className="absolute inset-0 flex items-center gap-3 px-5 bg-white border border-gray-100 rounded-full shadow-lg transition-transform duration-300 group-hover:scale-105">
              <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.188 16.544 5 20" />
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-gray-800 uppercase">Translate</span>
            </div>
          </div>

          {/* 2. 실제 클릭 레이어: 최상단 z-index 보장 */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full z-[100] cursor-pointer opacity-0"
          />
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.35; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }

        /* 구글 위젯이 죽지 않도록 크기 강제 고정 */
        #google_translate_element .goog-te-gadget-simple {
          width: 140px !important;
          height: 48px !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
          display: block !important;
        }

        /* 내부 텍스트만 투명하게 처리 (영역은 유지) */
        .goog-te-gadget-simple span, 
        .goog-te-gadget-simple img,
        .goog-te-menu-value {
          color: transparent !important;
        }

        /* 불필요한 바 제거 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
      `}</style>
    </>
  );
};

export default GoogleTranslate;