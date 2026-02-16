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
    // 구글 번역 스크립트 초기화 함수
    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'ko', 
          includedLanguages: 'ko,en,ja,zh-CN,vi,th', // 주요 언어 추가
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
      }
    };

    // 스크립트 로드
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);

    // 클린업
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      {/* 🟢 귀여운 디자인과 애니메이션이 적용된 컨테이너 */}
      <div 
        id="google_translate_element" 
        className="fixed bottom-6 right-6 z-[9999] bg-white p-1.5 rounded-full shadow-md border-2 border-indigo-100 cursor-pointer animate-pulse-cute hover:scale-105 transition-transform"
        title="Click to translate"
      />
      
      <style jsx global>{`
        /* 🟢 커졌다 작아졌다 하는 귀여운 애니메이션 정의 */
        @keyframes pulse-cute {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); transform: scale(1); }
          70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); transform: scale(1); }
        }

        /* 애니메이션 클래스 적용 */
        .animate-pulse-cute {
          animation: pulse-cute 2s infinite;
        }
        /* 마우스 올리면 애니메이션 일시 정지 (클릭 쉽게) */
        .animate-pulse-cute:hover {
          animation-play-state: paused;
        }

        /* 구글 번역기 자체의 못생긴 스타일 숨기기 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link { display: none !important; }
        .goog-te-gadget span { display: none !important; }
        #google_translate_element .goog-te-gadget-simple {
          background-color: transparent !important;
          border: none !important;
          padding: 4px !important;
          font-size: 14px !important;
          cursor: pointer !important;
        }
        /* 언어 선택 드롭다운 화살표 아이콘 스타일 */
        .goog-te-gadget-icon {
            background: none !important;
            display: none !important; /* 아이콘 숨기고 글자만 깔끔하게 */
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;