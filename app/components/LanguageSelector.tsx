'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const languages = [
    { label: '한국어', value: 'ko' },
    { label: 'English', value: 'en' },
    { label: '中文', value: 'zh' },
    { label: '日本語', value: 'ja' }
  ];

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (newLang: string) => {
    setLang(newLang);
    setIsOpen(false);

    // URL 변경 (SEO 적용)
    let newPath = pathname;
    
    // 기존 언어 프리픽스 제거
    // (예: /en/about -> /about, /about -> /about)
    const segments = pathname.split('/');
    if (['ko', 'en', 'ja', 'zh'].includes(segments[1])) {
      newPath = '/' + segments.slice(2).join('/');
    }

    // 새 언어 프리픽스 추가 (기본 언어 'ko'는 제외하거나 포함 - 정책에 따름)
    // 현재 정책: ko는 프리픽스 없이, 나머지는 붙임
    if (newLang !== 'ko') {
      newPath = `/${newLang}${newPath}`; // 예: /en/about
    } else {
      // ko일 때는 프리픽스 없이 루트로 (또는 기존 경로 유지)
      newPath = newPath || '/';
    }

    // 쿼리 파라미터 유지
    const params = searchParams.toString();
    if (params) {
      newPath += `?${params}`;
    }

    router.push(newPath);
  };

  return (
    <div className="relative hidden sm:block" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-2 hover:bg-slate-50 rounded-full transition-colors flex items-center justify-center text-slate-700"
      >
        <Globe size={18} />
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-40 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200] animate-in fade-in zoom-in-95 duration-200">
          {languages.map((l) => (
            <button 
              key={l.value} 
              onClick={() => handleLanguageChange(l.value)} 
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex justify-between items-center transition-colors ${
                lang === l.value ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-600'
              }`}
            >
              {l.label} 
              {lang === l.value && <Check size={14} className="text-rose-500"/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
