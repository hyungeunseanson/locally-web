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
        <div className="relative group w-[140px] h-[52px]"> {/* 고정 크기로 안정성 확보 */}
          
          {/* 1. 디자인 레이어 (이벤트 차단: pointer-events-none) */}
          <div className="pointer-events-none select-none">
            {/* 배경 글로우 */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 animate-pulse-slow"></div>
            
            {/* 글래스모피즘 버튼 디자인 */}
            <div className="absolute inset-0 flex items-center gap-3 px-6 py-3.5 bg-white/80 backdrop-blur-xl border border-white/40 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300">
              {/* 아이콘 */}
              <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm transform group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.188 16.544 5 20" />
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-gray-900 uppercase">
                Translate
              </span>
            </div>
          </div>

          {/* 2. 실제 구글 클릭 영역 (최상단 레이어, 투명) */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full z-20 cursor-pointer overflow-hidden rounded-full"
            style={{ opacity: 0 }}
          />
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.05); opacity: 0.35; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* 구글 필수 설정 (모달 간섭 절대 없음) */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        
        #google_translate_element .goog-te-gadget-simple {
          width: 100% !important;
          height: 100% !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
          display: block !important;
        }
        .goog-te-gadget-icon, .goog-te-gadget span, .goog-logo-link { display: none !important; }
      `}</style>
    </>
  );
};

export default GoogleTranslate;