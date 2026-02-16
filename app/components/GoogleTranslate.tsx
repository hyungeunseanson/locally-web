'use client';

import { useEffect } from 'react';
import { Globe } from 'lucide-react';

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
      {/* 🟢 줄바꿈 오류를 방지하기 위해 className을 한 줄로 정리했습니다. */}
      <div className="fixed bottom-6 right-6 z-[9999] group">
        <div className="relative flex items-center gap-2 bg-white px-4 py-3 rounded-full shadow-lg border-2 border-indigo-100 cursor-pointer animate-pulse-slow hover:scale-110 hover:border-indigo-300 hover:shadow-xl active:scale-95 active:bg-slate-50 transition-all duration-300 ease-in-out">
          <Globe className="w-5 h-5 text-indigo-500 group-hover:rotate-180 transition-transform duration-500" />
          <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
            Translate
          </span>

          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full opacity-0 overflow-hidden cursor-pointer"
          />
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes pulse-slow {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite;
        }
        .group:hover .animate-pulse-slow {
          animation: none;
        }
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link { display: none !important; }
        .goog-te-gadget span { display: none !important; }
        #google_translate_element .goog-te-gadget-simple {
          width: 100% !important;
          height: 100% !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .goog-te-gadget-icon {
          display: none !important;
        }
      `}</style>
    </>
  );
};

export default GoogleTranslate;