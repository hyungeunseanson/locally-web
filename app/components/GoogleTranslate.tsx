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
    // 1. 구글 번역 초기화 함수
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

    // 2. 스크립트 로드
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);

    // 3. 클린업 (컴포넌트 사라질 때 스크립트 제거)
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      <div 
        id="google_translate_element" 
        className="fixed bottom-6 right-6 z-[9999] bg-white p-1.5 rounded-full shadow-md border-2 border-indigo-100 cursor-pointer animate-pulse-cute hover:scale-105 transition-transform"
        title="Click to translate"
      />
      
      <style jsx global>{`
        @keyframes pulse-cute {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); transform: scale(1); }
          70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); transform: scale(1); }
        }

        .animate-pulse-cute {
          animation: pulse-cute 2s infinite;
        }
        
        .animate-pulse-cute:hover {
          animation-play-state: paused;
        }

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
        
        .goog-te-gadget-icon {
            background: none !important;
            display: none !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;