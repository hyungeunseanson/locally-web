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
          includedLanguages: 'ko,en,ja,zh-CN',
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
      {/* 화면 우측 하단 고정 위젯 */}
      <div 
        id="google_translate_element" 
        className="fixed bottom-5 right-5 z-[9999] opacity-80 hover:opacity-100 transition-opacity bg-white p-2 rounded-lg shadow-lg"
      />
      
      <style jsx global>{`
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link { display: none !important; }
        .goog-te-gadget span { display: none !important; }
        #google_translate_element .goog-te-gadget-simple {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          font-size: 14px !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;