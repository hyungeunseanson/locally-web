'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const SUPPORTED_LOCALES = ['ko', 'en', 'ja', 'zh'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const LANGUAGE_OPTIONS: Array<{ label: string; value: Locale }> = [
  { label: '한국어', value: 'ko' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
  { label: '日本語', value: 'ja' },
];

const isSupportedLocale = (value: string): value is Locale => {
  return SUPPORTED_LOCALES.includes(value as Locale);
};

const buildLocalizedPath = (pathname: string, newLang: Locale) => {
  let newPath = pathname || '/';
  const segments = newPath.split('/');

  if (isSupportedLocale(segments[1] || '')) {
    newPath = '/' + segments.slice(2).join('/');
  }

  if (!newPath.startsWith('/')) {
    newPath = `/${newPath}`;
  }

  if (newPath === '') {
    newPath = '/';
  }

  if (newLang !== 'ko') {
    newPath = `/${newLang}${newPath}`;
  } else {
    newPath = newPath || '/';
  }

  return newPath;
};

type MobileLanguageSwitcherProps = {
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

export default function MobileLanguageSwitcher({
  className = '',
  buttonClassName = '',
  menuClassName = '',
}: MobileLanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (newLang: Locale) => {
    setLang(newLang);
    setIsOpen(false);

    const nextPath = buildLocalizedPath(pathname || '/', newLang);
    const params = searchParams.toString();
    router.push(params ? `${nextPath}?${params}` : nextPath);
  };

  return (
    <div className={`relative md:hidden ${className}`.trim()} ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition-transform ${buttonClassName}`.trim()}
        aria-label="모바일 언어 전환"
      >
        <Globe size={16} />
      </button>

      {isOpen && (
        <div
          className={`absolute top-11 right-0 w-36 bg-white border border-slate-100 rounded-xl shadow-xl py-1.5 z-[220] ${menuClassName}`.trim()}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleLanguageChange(option.value)}
              className={`w-full text-left px-3.5 py-2 text-[12px] flex items-center justify-between hover:bg-slate-50 transition-colors ${
                lang === option.value ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-600'
              }`}
            >
              <span>{option.label}</span>
              {lang === option.value && <Check size={13} className="text-rose-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
