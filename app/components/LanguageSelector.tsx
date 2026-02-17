'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
              onClick={() => { setLang(l.value); setIsOpen(false); }} 
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