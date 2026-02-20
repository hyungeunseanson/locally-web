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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'ko', 
          includedLanguages: 'ko,en,ja,zh-CN,vi,th',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
        setIsLoaded(true);
      }
    };
  }, []);

  return (
    <>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
      
      <div className="fixed bottom-8 right-8 z-[9999] group">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-4 border-slate-50 animate-jelly cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300">
          {/* Google 로고 아이콘/텍스트 */}
          <div className="flex font-black text-2xl tracking-tighter select-none">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">o</span>
          </div>

          {/* 구글 번역기 엘리먼트 - 실제 클릭 영역 */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full z-20 overflow-hidden"
            style={{ opacity: 0.01 }} // 0이 아닌 최소값으로 클릭 유지
          />
        </div>
        
        {/* 툴팁 */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold shadow-lg">
          {isLoaded ? 'Translate! 🎈' : 'Loading...'}
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes jelly {
          0%, 100% { transform: scale(1, 1); }
          25% { transform: scale(0.9, 1.1); }
          50% { transform: scale(1.1, 0.9); }
          75% { transform: scale(0.95, 1.05); }
        }
        .animate-jelly { animation: jelly 2s infinite ease-in-out; }
        .group:hover .animate-jelly { animation-play-state: paused; }
        
        /* 구글 번역기 기본 UI 숨기기 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link, .goog-te-gadget span { display: none !important; }
        
        /* 커스텀 버튼에 맞게 내부 요소 확장 */
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
        .goog-te-gadget-icon { display: none !important; }
        .goog-te-menu-value span { display: none !important; }
        .goog-te-menu-value img { display: none !important; }
        .goog-te-menu-value:after { content: '' !important; }

        /* 선택 후 생기는 텍스트 숨기기 */
        .goog-te-menu-value {
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;