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
      
      {/* 에어비엔비 스타일 모던 버튼 */}
      <div className="fixed bottom-8 right-8 z-[9999]">
        <div className="relative flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer active:scale-95 group">
          {/* 지구본 아이콘 (SVG) */}
          <svg 
            viewBox="0 0 16 16" 
            xmlns="http://www.w3.org/2000/svg" 
            className="w-4 h-4 text-gray-700"
            fill="currentColor"
          >
            <path d="M8 0a8 8 0 1 0 8 8A8.011 8.011 0 0 0 8 0zm6 8c0 .341-.024.677-.07 1.004l-1.922.61a.5.5 0 0 1-.58-.216L10.3 7.58a.5.5 0 0 1 .054-.576l.823-.988a.5.5 0 0 1 .536-.153l1.854.556c.264.504.433 1.066.433 1.581zM1.07 9.004c-.046-.327-.07-.663-.07-1.004 0-.515.169-1.077.433-1.581l1.854-.556a.5.5 0 0 1 .536.153l.823.988a.5.5 0 0 1 .054.576l-1.128 1.82a.5.5 0 0 1-.58.216l-1.922-.61zM8 1a6.953 6.953 0 0 1 2.307.395l-.261.26a.5.5 0 0 1-.68.026C8.803 1.155 8.411 1 8 1s-.803.155-1.366.681a.5.5 0 0 1-.68-.026l-.261-.26A6.953 6.953 0 0 1 8 1zM2.083 4.657A6.955 6.955 0 0 1 5.343 1.391l.24.239a.5.5 0 0 1 .012.695C5.068 2.89 4.8 3.738 4.8 4.5c0 .185.016.37.047.553a.5.5 0 0 1-.368.568l-1.783.446a.5.5 0 0 1-.531-.225l-.082-.185zM4.8 8c0-.623.197-1.21.536-1.696a.5.5 0 0 1 .71-.1l1.417 1.063a.5.5 0 0 1 .137.601l-1.001 2.002a.5.5 0 0 1-.61.258l-1.012-.337A4.479 4.479 0 0 1 4.8 8zm3.2 6.5c-.411 0-.803-.155-1.366-.681a.5.5 0 0 1-.026-.68l.26-.261c.422.316.822.428 1.132.428s.71-.112 1.132-.428l.26.261a.5.5 0 0 1-.026.68C8.803 14.345 8.411 14.5 8 14.5zm2.666-1.109l.24-.239a.5.5 0 0 1 .695-.012c.473.473.741 1.321.741 2.083 0 .185-.016.37-.047.553a.5.5 0 0 1-.568.368l-1.783-.446a.5.5 0 0 1-.225-.531l.947-1.776zM8 11.5c.623 0 1.21-.197 1.696-.536a.5.5 0 0 1 .1-.71l-1.063-1.417a.5.5 0 0 1-.601-.137L6.13 9.699a.5.5 0 0 1-.258.61l.337 1.012A4.479 4.479 0 0 0 8 11.5z"/>
          </svg>
          
          <span className="text-sm font-semibold text-gray-700 select-none">
            {isLoaded ? 'Translate' : 'Loading...'}
          </span>

          {/* 구글 번역기 실제 클릭 포인트 - 버튼 전체를 덮음 */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full z-20 overflow-hidden cursor-pointer"
          />
        </div>
      </div>
      
      <style jsx global>{`
        /* 구글 번역기 기본 UI 제거 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link, .goog-te-gadget span { display: none !important; }
        
        /* 버튼 전체를 클릭 가능하게 확장 */
        #google_translate_element .goog-te-gadget-simple {
          width: 100% !important;
          height: 100% !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
          display: block !important;
          opacity: 0 !important; /* 내부 요소는 투명하게 하여 커스텀 디자인 유지 */
        }
        
        /* 메뉴 팝업 스타일 조정 (선택 사항) */
        .goog-te-menu-frame {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          border-radius: 12px !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;