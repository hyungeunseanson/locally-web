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

  // Hydration 에러 방지: 클라이언트에서 마운트되기 전에는 아무것도 렌더링하지 않음
  if (!mounted) return null;

  return (
    <>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
      
      <div className="fixed bottom-10 right-10 z-[9999]">
        <div className="relative group">
          {/* 외부 글로우 효과 */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          
          <div className="relative flex items-center gap-3 px-6 py-3.5 bg-white/90 backdrop-blur-xl border border-white/40 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.15)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-all duration-500 hover:-translate-y-1 active:scale-95 cursor-pointer">
            
            {/* 세련된 그라데이션 아이콘 배경 */}
            <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg rotate-3 group-hover:rotate-12 transition-transform duration-500">
              <svg 
                className="w-4 h-4 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.188 16.544 5 20" />
              </svg>
            </div>
            
            <span className="text-sm font-bold tracking-tight text-gray-900 select-none uppercase">
              Translate
            </span>

            {/* 실제 구글 클릭 영역 - 최상단에 배치하고 투명하게 유지 */}
            <div 
              id="google_translate_element" 
              className="absolute inset-0 w-full h-full z-50 cursor-pointer rounded-full overflow-hidden"
              style={{ opacity: 0.02 }}
            />
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        /* 구글 기본 UI 제거 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link, .goog-te-gadget span, .goog-te-gadget-icon { display: none !important; }
        
        /* 위젯 내부 요소를 버튼 전체에 꽉 채움 */
        #google_translate_element .goog-te-gadget-simple {
          width: 100% !important;
          height: 100% !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        /* 팝업 메뉴 모던화 */
        iframe.goog-te-menu-frame {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          border-radius: 24px !important;
          border: 1px solid rgba(0,0,0,0.05) !important;
          margin-top: 15px !important;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* 메뉴 내부 글꼴 등 (접근 가능한 경우) */
        .goog-te-menu2 {
          font-family: inherit !important;
          padding: 12px !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;