'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: any;
  }
}

const GoogleTranslate = () => {
  useEffect(() => {
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

    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      {/* 🟢 구글 로고 색감을 입힌 젤리 버튼 */}
      <div className="fixed bottom-8 right-8 z-[9999] group">
        <div className="
          relative flex items-center justify-center w-16 h-16 rounded-full 
          bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-4 border-slate-50
          animate-jelly cursor-pointer
          hover:scale-125 active:scale-90
          transition-all duration-300 ease-[border-radius,transform]
        ">
          {/* G 로고 느낌의 텍스트 (구글 색상 적용) */}
          <div className="flex font-black text-2xl tracking-tighter select-none">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">o</span>
          </div>

          {/* 🟢 실제 구글 번역 위젯 (버튼 전체를 덮음) */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full opacity-0 overflow-hidden cursor-pointer z-10"
          />
        </div>
        
        {/* 말풍선 툴팁 */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold">
          Translate! 🎈
        </div>
      </div>
      
      <style jsx global>{`
        /* 🍮 통통 튀는 젤리 애니메이션 */
        @keyframes jelly {
          0%, 100% { transform: scale(1, 1); }
          25% { transform: scale(0.9, 1.1); }
          50% { transform: scale(1.1, 0.9); }
          75% { transform: scale(0.95, 1.05); }
        }

        .animate-jelly {
          animation: jelly 2s infinite ease-in-out;
        }

        /* 호버 시 애니메이션 일시 정지 후 커짐 */
        .group:hover .animate-jelly {
          animation-play-state: paused;
        }

        /* 구글 기본 UI 강제 숨김 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link, .goog-te-gadget span { display: none !important; }
        
        /* 투명 버튼 클릭 영역 확보 */
        #google_translate_element .goog-te-gadget-simple {
          width: 100% !important;
          height: 100% !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          cursor: pointer !important;
        }
        .goog-te-gadget-icon { display: none !important; }

        /* 클릭 시 나오는 구글 기본 모달 디자인은 브라우저 제어 영역이라 
           우리가 직접적으로 수정하기 매우 어렵습니다. */
      `}</style>
    </>
  );
};

export default GoogleTranslate;