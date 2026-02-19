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
          
{/* 🟢 탭 버튼 (비율 완벽 수정: 동글동글한 3D 아이콘) */}
<div
            className={
              isScrolled
                ? 'flex gap-8 mb-4 transition-all duration-300 opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden'
                : 'flex gap-12 mb-6 transition-all duration-300 opacity-100 translate-y-0 h-auto'
            }
          >
            {/* 🎈 체험 탭 (둥근 열기구 형태) */}
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
              
              {/* 아이콘: 44px (동그란 비율) */}
              <div className="h-[48px] flex items-end justify-center mb-1">
                <svg width="44" height="44" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-sm transition-transform duration-500 ${activeTab === 'experience' ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3'}`}>
                  <defs>
                    <linearGradient id="balloonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFC107" /> {/* 밝은 노랑 */}
                      <stop offset="50%" stopColor="#FF5722" /> {/* 주황 */}
                      <stop offset="100%" stopColor="#D84315" /> {/* 진한 주황 */}
                    </linearGradient>
                    <radialGradient id="balloonShine" cx="30%" cy="30%" r="60%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.5"/>
                      <stop offset="100%" stopColor="white" stopOpacity="0"/>
                    </radialGradient>
                  </defs>
                  
                  {/* 풍선 본체 (훨씬 둥글게 수정됨) */}
                  <path d="M25 2 C 11 2, 2 16, 25 40 C 48 16, 39 2, 25 2" fill="url(#balloonGrad)" />
                  {/* 하이라이트 (광택) */}
                  <ellipse cx="16" cy="14" rx="8" ry="6" fill="url(#balloonShine)" transform="rotate(-20 16 14)" />
                  
                  {/* 줄 & 바구니 (위치 조정) */}
                  <g stroke="#5D4037" strokeWidth="1.2">
                    <line x1="20" y1="40" x2="19" y2="45" />
                    <line x1="25" y1="40" x2="25" y2="45" />
                    <line x1="30" y1="40" x2="31" y2="45" />
                  </g>
                  <rect x="18" y="45" width="14" height="4" fill="#795548" rx="1" />
                </svg>
              </div>
              
              {/* 텍스트 */}
              <span className={`text-[15px] font-bold pb-1.5 border-b-[2px] transition-all ${
                activeTab === 'experience' ? 'text-black border-black' : 'text-[#717171] border-transparent'
              }`}>
                {t('cat_exp')}
              </span>
            </button>

            {/* 🛎️ 서비스 탭 (납작하고 귀여운 종) */}
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
              
              {/* 아이콘: 44px */}
              <div className="h-[48px] flex items-end justify-center mb-1">
                <svg width="44" height="44" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-sm transition-transform duration-500 origin-top ${activeTab === 'service' ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-6'}`}>
                  <defs>
                    <linearGradient id="bellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#F5F5F5" />
                      <stop offset="100%" stopColor="#B0BEC5" />
                    </linearGradient>
                  </defs>
                  
                  {/* 손잡이 (검정 구슬) */}
                  <circle cx="25" cy="10" r="4" fill="#37474F" />
                  
                  {/* 종 본체 (납작하게 조정) */}
                  <path d="M12 40 C 12 20, 38 20, 38 40 L 25 40 Z" fill="url(#bellGrad)" stroke="#90A4AE" strokeWidth="0.5"/> 
                  {/* 실제 종 모양 Path 수정 */}
                  <path d="M10 40 C 10 22, 40 22, 40 40 L 25 48 L 10 40" fill="url(#bellGrad)" />
                  
                  {/* 광택 라인 */}
                  <path d="M16 26 C 16 22, 22 22, 20 28" fill="none" stroke="white" strokeWidth="2.5" strokeOpacity="0.7" strokeLinecap="round" />

                  {/* 받침대 & 타격점 */}
                  <rect x="10" y="38" width="30" height="3" fill="#E53935" rx="1.5" />
                  <circle cx="25" cy="46" r="3" fill="#37474F" opacity="0.3" />
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