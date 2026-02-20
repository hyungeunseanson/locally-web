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
    // 전역 초기화 함수 등록
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

    // 이미 스크립트가 로드된 경우 대응
    if (window.google && window.google.translate) {
      window.googleTranslateElementInit();
    }
  }, []);

  return (
    <>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
      
      <div className="fixed bottom-10 right-10 z-[9999]">
        <div className="relative group">
          {/* 배경 애니메이션 */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse-slow"></div>
          
          {/* 버튼 컨테이너 (div로 변경하여 이벤트 간섭 최소화) */}
          <div className="relative flex items-center gap-2.5 px-5 py-3 bg-white/90 backdrop-blur-md border border-white/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all duration-500 ease-out active:scale-90 cursor-pointer">
            
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

            {/* 실제 구글 클릭 영역 - opacity를 0이 아닌 최소값으로 설정 */}
            <div 
              id="google_translate_element" 
              className="absolute inset-0 w-full h-full z-20 cursor-pointer rounded-full"
              style={{ opacity: 0.02 }}
            />
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.35; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

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
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        /* 메뉴 창 스타일 보강 */
        iframe.goog-te-menu-frame {
          box-shadow: 0 24px 48px rgba(0,0,0,0.18) !important;
          border-radius: 20px !important;
          border: none !important;
          margin-top: 12px !important;
          animation: menu-appear 0.3s ease-out !important;
        }

        @keyframes menu-appear {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;