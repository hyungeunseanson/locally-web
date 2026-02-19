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
          
{/* 🟢 탭 버튼 (고화질 3D 벡터 아이콘 + CSS 애니메이션) */}
<div
            className={
              isScrolled
                ? 'flex gap-8 mb-4 transition-all duration-300 opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden'
                : 'flex gap-12 mb-6 transition-all duration-300 opacity-100 translate-y-0 h-auto'
            }
          >
            {/* 🎈 체험 탭 (High-Quality 3D Balloon) */}
            <button
              onClick={() => setActiveTab('experience')}
              className={`relative flex flex-col items-center group transition-all duration-300 outline-none ${
                activeTab === 'experience' 
                  ? 'opacity-100' 
                  : 'opacity-50 hover:opacity-100 grayscale-[40%] hover:grayscale-0'
              }`}
            >
              {/* NEW 라벨 */}
              <div className="absolute -top-1 -right-2 bg-[#FF385C] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-10 transition-transform group-hover:scale-110">
                NEW
              </div>
              
              {/* 아이콘: 고화질 SVG (크기 44px로 시원하게 키움) */}
              <div className="h-[48px] flex items-end justify-center mb-1">
                <svg width="44" height="48" viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-sm transition-transform duration-500 ${activeTab === 'experience' ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3'}`}>
                  <defs>
                    <linearGradient id="balloonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFCC00" />
                      <stop offset="50%" stopColor="#FF6600" />
                      <stop offset="100%" stopColor="#CC0000" />
                    </linearGradient>
                    <radialGradient id="balloonShine" cx="30%" cy="30%" r="50%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="white" stopOpacity="0"/>
                    </radialGradient>
                  </defs>
                  {/* 풍선 본체 */}
                  <path d="M25 0 C10 20, 10 40, 25 60 C40 40, 40 20, 25 0" fill="url(#balloonGrad)" />
                  {/* 입체광 (하이라이트) */}
                  <ellipse cx="18" cy="15" rx="8" ry="12" fill="url(#balloonShine)" transform="rotate(-15 18 15)" />
                  
                  {/* 줄 & 바구니 */}
                  <g stroke="#5D4037" strokeWidth="1.2">
                    <line x1="20" y1="50" x2="20" y2="55" />
                    <line x1="25" y1="50" x2="25" y2="55" />
                    <line x1="30" y1="50" x2="30" y2="55" />
                  </g>
                  <rect x="18" y="55" width="14" height="5" fill="#795548" rx="1" />
                </svg>
              </div>
              
              {/* 텍스트 */}
              <span className={`text-[15px] font-bold pb-1.5 border-b-[2px] transition-all ${
                activeTab === 'experience' ? 'text-black border-black' : 'text-[#717171] border-transparent'
              }`}>
                {t('cat_exp')}
              </span>
            </button>

            {/* 🛎️ 서비스 탭 (High-Quality 3D Bell) */}
            <button
              onClick={() => setActiveTab('service')}
              className={`relative flex flex-col items-center group transition-all duration-300 outline-none ${
                activeTab === 'service' 
                  ? 'opacity-100' 
                  : 'opacity-50 hover:opacity-100 grayscale-[40%] hover:grayscale-0'
              }`}
            >
              {/* NEW 라벨 */}
              <div className="absolute -top-1 -right-2 bg-[#0066CC] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-10 transition-transform group-hover:scale-110">
                NEW
              </div>
              
              {/* 아이콘: 고화질 SVG (크기 44px) */}
              <div className="h-[48px] flex items-end justify-center mb-1">
                <svg width="44" height="44" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-sm transition-transform duration-500 origin-top ${activeTab === 'service' ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-6'}`}>
                  <defs>
                    <linearGradient id="bellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#F5F5F5" />
                      <stop offset="100%" stopColor="#BDBDBD" />
                    </linearGradient>
                    <linearGradient id="bellMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#E0E0E0" />
                      <stop offset="50%" stopColor="#FFFFFF" />
                      <stop offset="100%" stopColor="#9E9E9E" />
                    </linearGradient>
                  </defs>
                  {/* 종 본체 */}
                  <path d="M10 40 C10 18, 40 18, 40 40 L25 48 L10 40" fill="url(#bellGrad)" />
                  {/* 금속 광택 효과 */}
                  <path d="M15 25 C15 20, 20 20, 20 25" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.6" />
                  
                  {/* 손잡이 & 받침 */}
                  <circle cx="25" cy="12" r="4" fill="#333333" />
                  <rect x="10" y="38" width="30" height="3" fill="#D32F2F" rx="1" />
                  <ellipse cx="25" cy="46" rx="12" ry="2" fill="#333333" fillOpacity="0.2" />
                </svg>
              </div>
              
              {/* 텍스트 */}
              <span className={`text-[15px] font-bold pb-1.5 border-b-[2px] transition-all ${
                activeTab === 'service' ? 'text-black border-black' : 'text-[#717171] border-transparent'
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