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
        <div className="relative">
          {/* 시각적 버튼 레이어 (단순화) */}
          <div className="flex items-center gap-3 px-6 py-3.5 bg-white border border-gray-200 rounded-full shadow-xl">
            <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.188 16.544 5 20" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900 uppercase tracking-tight">Translate</span>
          </div>

          {/* 실제 구글 번역 요소 - 클릭 이벤트를 직접 받도록 설정 */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full z-10 cursor-pointer"
            style={{ opacity: 0.01 }}
          />
        </div>
      </div>
      
      <style jsx global>{`
        /* 기능 작동을 위해 모달 관련 커스텀 스타일을 모두 제거함 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link, .goog-te-gadget span, .goog-te-gadget-icon { display: none !important; }
        
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
      `}</style>
    </>
  );
};

export default GoogleTranslate;