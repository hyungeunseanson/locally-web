'use client';

import React from 'react';
import { Search } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import MainSearchBar from '@/app/components/MainSearchBar';
import { CATEGORIES } from '@/app/constants';
import { useLanguage } from '@/app/context/LanguageContext';

interface HomeHeroProps {
  activeTab: 'experience' | 'service';
  setActiveTab: (tab: 'experience' | 'service') => void;
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  isScrolled: boolean;
  
  // ✅ [수정] 'language' 타입 추가
  activeSearchField: 'location' | 'date' | 'language' | null;
  setActiveSearchField: (field: 'location' | 'date' | 'language' | null) => void;
  
  locationInput: string;
  setLocationInput: (val: string) => void;
  dateRange: { start: Date | null, end: Date | null };
  setDateRange: (range: any) => void;
  searchRef: React.RefObject<HTMLDivElement | null>;
  onSearch: () => void;
  
  // ✅ [추가] 부모(HomePage)에서 보내주는 언어 관련 Props도 받아야 함
  selectedLanguage?: string;
  setSelectedLanguage?: (lang: string) => void;
}

export default function HomeHero({

  activeTab, setActiveTab,
  selectedCategory, setSelectedCategory,
  isScrolled,
  activeSearchField, setActiveSearchField,
  locationInput, setLocationInput,
  dateRange, setDateRange,
  searchRef,
  onSearch,
  
  // 👇 여기 두 줄을 꼭 추가해주세요!
  selectedLanguage, 
  setSelectedLanguage 
}: HomeHeroProps) {
  const { t } = useLanguage(); // 🟢 추가
  return (
    <>
      {/* 🟢 1. 상단 고정 헤더 & Sticky 캡슐 검색바 */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-sm' : ''} h-20`}>
        <SiteHeader />
        
        {/* 스크롤 시 나타나는 작은 검색바 */}
        <div 
          className={[
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'flex items-center bg-white border border-slate-300 rounded-full',
            'shadow-sm hover:shadow-md h-12 px-2 cursor-pointer z-[100]',
            'transition-all duration-300 ease-in-out',
            isScrolled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none',
          ].join(' ')}
          onClick={() => { window.scrollTo({top: 0, behavior: 'smooth'}); setActiveSearchField('location'); }}
        >
<div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">{t('anywhere')}</div>
<div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">{t('anytime')}</div>
<div className="px-4 text-sm font-bold text-slate-500">{t('search')}</div>
          <button className="w-8 h-8 bg-[#FF385C] rounded-full flex items-center justify-center text-white ml-2">
            <Search size={14} strokeWidth={3}/>
          </button>
        </div>
      </div>

      {/* 🟢 2. 메인 확장 검색바 & 탭 영역 */}
      <div className="pt-24 pb-6 px-6 relative z-40 bg-white" ref={searchRef}>
        <div className="flex flex-col items-center relative">
          
{/* 🟢 탭 버튼 (귀엽고 예쁜 3D 아이콘 적용) */}
<div
            className={
              isScrolled
                ? 'flex gap-8 mb-4 transition-all duration-300 opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden'
                : 'flex gap-12 mb-6 transition-all duration-300 opacity-100 translate-y-0 h-auto'
            }
          >
            {/* 📷 체험 탭 (3D 핑크 카메라) */}
            <button
              onClick={() => setActiveTab('experience')}
              className={`relative flex flex-col items-center group transition-all duration-300 outline-none ${
                activeTab === 'experience' 
                  ? 'opacity-100 scale-105' 
                  : 'opacity-50 hover:opacity-100 grayscale-[40%] hover:grayscale-0 scale-100'
              }`}
            >
              {/* NEW 라벨 (아이콘 우측 상단에 앙증맞게 배치) */}
              <div className="absolute -top-1.5 -right-3 bg-[#FF385C] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-10 animate-bounce-slow">
                NEW
              </div>
              
              {/* 아이콘: 귀여운 3D 카메라 */}
              <div className="h-[42px] flex items-end justify-center mb-2">
                <svg width="42" height="42" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm transition-transform group-hover:-rotate-3">
                  <defs>
                    <linearGradient id="camGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FF9A9E" />
                      <stop offset="100%" stopColor="#FECFEF" />
                    </linearGradient>
                    <linearGradient id="lensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#434343" />
                      <stop offset="100%" stopColor="#000000" />
                    </linearGradient>
                  </defs>
                  {/* 카메라 바디 */}
                  <rect x="4" y="10" width="32" height="22" rx="6" fill="url(#camGrad)" />
                  <path d="M4 16 Q4 10 10 10 L30 10 Q36 10 36 16" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.4" />
                  {/* 셔터 버튼 */}
                  <rect x="26" y="6" width="6" height="4" rx="1.5" fill="#FF758C" />
                  {/* 렌즈 */}
                  <circle cx="20" cy="21" r="8" fill="#F0F0F0" stroke="#E0E0E0" strokeWidth="1" />
                  <circle cx="20" cy="21" r="6" fill="url(#lensGrad)" />
                  <circle cx="21.5" cy="19.5" r="1.5" fill="#FFFFFF" fillOpacity="0.8" />
                </svg>
              </div>
              
              {/* 텍스트 */}
              <span className={`text-[15px] font-bold pb-1.5 border-b-[3px] transition-all ${
                activeTab === 'experience' ? 'text-slate-900 border-slate-900' : 'text-slate-500 border-transparent'
              }`}>
                {t('cat_exp')}
              </span>
            </button>

            {/* ✨ 서비스 탭 (3D 블루 스파클) */}
            <button
              onClick={() => setActiveTab('service')}
              className={`relative flex flex-col items-center group transition-all duration-300 outline-none ${
                activeTab === 'service' 
                  ? 'opacity-100 scale-105' 
                  : 'opacity-50 hover:opacity-100 grayscale-[40%] hover:grayscale-0 scale-100'
              }`}
            >
              {/* NEW 라벨 */}
              <div className="absolute -top-1.5 -right-3 bg-[#0066CC] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-10 animate-bounce-slow">
                NEW
              </div>
              
              {/* 아이콘: 귀여운 3D 스파클/다이아몬드 */}
              <div className="h-[42px] flex items-end justify-center mb-2">
                <svg width="42" height="42" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm transition-transform group-hover:rotate-6">
                  <defs>
                    <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4facfe" />
                      <stop offset="100%" stopColor="#00f2fe" />
                    </linearGradient>
                  </defs>
                  {/* 중앙 큰 별 */}
                  <path d="M20 4 L23 14 L33 17 L23 20 L20 30 L17 20 L7 17 L17 14 Z" fill="url(#sparkleGrad)" />
                  <path d="M20 4 L23 14 L33 17 L23 20" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.4" />
                  
                  {/* 주변 작은 별들 (장식) */}
                  <path d="M32 6 L33 9 L36 10 L33 11 L32 14 L31 11 L28 10 L31 9 Z" fill="#FFD700" />
                  <path d="M8 26 L9 29 L12 30 L9 31 L8 34 L7 31 L4 30 L7 29 Z" fill="#FFD700" />
                </svg>
              </div>
              
              {/* 텍스트 */}
              <span className={`text-[15px] font-bold pb-1.5 border-b-[3px] transition-all ${
                activeTab === 'service' ? 'text-slate-900 border-slate-900' : 'text-slate-500 border-transparent'
              }`}>
                {t('cat_service')}
              </span>
            </button>
          </div>

          <MainSearchBar 
            activeSearchField={activeSearchField}
            setActiveSearchField={setActiveSearchField}
            locationInput={locationInput}
            setLocationInput={setLocationInput}
            dateRange={dateRange}
            setDateRange={setDateRange}
            
// ✅ [수정] '전체'를 'all'로 바꿔야 번역이 작동합니다!
            selectedLanguage={selectedLanguage || 'all'} 
            setSelectedLanguage={setSelectedLanguage || (() => {})}
            onCategorySelect={setSelectedCategory}
            isVisible={!isScrolled} 
            onSearch={onSearch} 
          />
        </div>
      </div>

      {/* 🟢 3. 카테고리 필터 */}
      {activeTab === 'experience' && (
        <div className="bg-white pb-4 pt-2 border-b border-slate-100 relative z-30">
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex justify-center">
            <div className="flex items-center gap-8 overflow-x-auto no-scrollbar pb-2 w-full justify-start md:justify-center">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={
                    selectedCategory === cat.id
                      ? 'flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group border-black opacity-100'
                      : 'flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'
                  }
                >
                  <span className="text-2xl transition-transform group-hover:scale-110">{cat.icon}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-black' : 'text-slate-600'}`}>
  {t(cat.label)} {/* 🟢 t() 함수로 감싸주세요 */}
</span>                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}