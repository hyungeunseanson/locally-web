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
      if (window.google && window.google.translate && !isLoaded) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'ko', 
          includedLanguages: 'ko,en,ja,zh-CN,vi,th',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
        setIsLoaded(true);
      }
    };
  }, [isLoaded]);

  return (
    <>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
      
      {/* 프리미엄 모던 번역 버튼 */}
      <div className="fixed bottom-10 right-10 z-[9999]">
        <div className="relative group">
          {/* 배경 애니메이션 (은은하게 커졌다 작아졌다 하는 효과) */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse-slow"></div>
          
          <button className="relative flex items-center gap-2.5 px-5 py-3 bg-white/80 backdrop-blur-md border border-white/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all duration-500 ease-out active:scale-90 group">
            {/* 세련된 번역 아이콘 */}
            <svg 
              className="w-5 h-5 text-gray-800 transition-transform duration-500 group-hover:rotate-12" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.188 16.544 5 20" />
            </svg>
            
            <span className="text-sm font-medium tracking-tight text-gray-800 select-none">
              {isLoaded ? 'Translate' : 'Loading...'}
            </span>

            {/* 실제 구글 클릭 영역 - 버튼 전체를 덮으면서 투명함 */}
            <div 
              id="google_translate_element" 
              className="absolute inset-0 w-full h-full z-20 opacity-0 cursor-pointer overflow-hidden rounded-full"
            />
          </button>
        </div>
      </div>
      
      <style jsx global>{`
        /* 은은한 숨쉬기 애니메이션 */
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.35; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* 구글 번역기 UI 강제 제거 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link, .goog-te-gadget span, .goog-te-gadget-icon { display: none !important; }
        
        /* 위젯 내부 요소를 버튼 크기에 맞춤 */
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

        /* 90년대 스타일 메뉴창을 최대한 현대적으로 수정 */
        .goog-te-menu-frame {
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
          border-radius: 16px !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          overflow: hidden !important;
          margin-top: 10px !important;
        }

        /* 메뉴 내부 스타일 (일부 브라우저 허용 범위 내) */
        .goog-te-menu2 {
          border: none !important;
          border-radius: 16px !important;
          padding: 8px !important;
          background-color: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;