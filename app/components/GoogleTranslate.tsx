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
        console.log('Google Translate Initialized');
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
        <div className="relative group">
          {/* 디자인은 그대로 유지하되 클릭 방해 요소 제거 */}
          <div className="flex items-center gap-3 px-6 py-3.5 bg-white border border-gray-200 rounded-full shadow-xl cursor-pointer">
            <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.188 16.544 5 20" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900 uppercase tracking-tight">Translate</span>
          </div>

          {/* 실제 구글 요소 - 1차 성공 버전의 구조로 복원 */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full z-20 cursor-pointer overflow-hidden"
            style={{ opacity: 0 }}
          />
        </div>
      </div>
      
      <style jsx global>{`
        /* 구글 상단 바와 불필요한 텍스트만 숨김 (기능 필수 요소는 건드리지 않음) */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        
        /* 모달 관련 모든 커스텀 스타일 삭제 (순정 상태 유지) */
        
        /* 클릭 영역 확보를 위한 최소 스타일 */
        #google_translate_element .goog-te-gadget-simple {
          width: 100% !important;
          height: 100% !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;