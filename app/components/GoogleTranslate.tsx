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
      {/* 🟢 커스텀 번역 버튼 컨테이너 */}
      <div className="fixed bottom-6 right-6 z-[9999] group">
        <div className="
          relative flex items-center gap-2 bg-white px-4 py-3 rounded-full 
          shadow-lg border-2 border-indigo-100 cursor-pointer 
          animate-pulse-slow
          hover:scale-110 hover:border-indigo-300 hover:shadow-xl
          active:scale-95 active:bg-slate-50
          transition-all duration-300 ease-in-out
        ">
          {/* 아이콘 및 텍스트 */}
          <Globe className="w-5 h-5 text-indigo-500 group-hover:rotate-180 transition-transform duration-500" />
          <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
            Translate
          </span>

          {/* 🟢 실제 구글 번역 위젯 (투명하게 덮어서 클릭 유도) */}
          <div 
            id="google_translate_element" 
            className="absolute inset-0 w-full h-full opacity-0 overflow-hidden cursor-pointer"
          />
        </div>
      </div>
      
      <style jsx global>{`
        /* 콩닥콩닥 애니메이션 (조금 더 부드럽게) */
        @keyframes pulse-slow {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s infinite;
        }
        
        /* 마우스 올리면 콩닥거림 멈추고 커진 상태 유지 */
        .group:hover .animate-pulse-slow {
          animation: none;
        }

        /* 구글 기본 UI 숨김 처리 */
        .goog-te-banner-frame { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link { display: none !important; }
        .goog-te-gadget span { display: none !important; }
        
        /* 투명화된 위젯 내부 요소 크기 강제 확장 (클릭 영역 확보) */
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