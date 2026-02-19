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

// 🟢 [추가] "진짜 이모지처럼 감쪽같이 만든" 커스텀 SVG 이모지 렌더러
const renderKoreanEmoji = (id: string) => {
  // text-2xl(24px) 크기에 딱 맞는 28px 사이즈 지정
  const size = "28"; 
  const style = { display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.1))' };

  if (id === 'seoul') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 서울: 남산타워 (애플 이모지 스타일) */}
        <path d="M4 30 C 4 22, 12 18, 16 18 C 20 18, 28 22, 28 30 Z" fill="url(#seoul-mt)" />
        <defs>
          <linearGradient id="seoul-mt" x1="16" y1="18" x2="16" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#66BB6A"/><stop offset="1" stopColor="#388E3C"/>
          </linearGradient>
          <linearGradient id="seoul-deck" x1="10" y1="10" x2="22" y2="17" gradientUnits="userSpaceOnUse">
            <stop stopColor="#29B6F6"/><stop offset="1" stopColor="#0277BD"/>
          </linearGradient>
        </defs>
        <path d="M13 22 L19 22 L17 14 L15 14 Z" fill="#E0E0E0"/>
        <path d="M15 14 L17 14 L17 22 L15 22 Z" fill="#FFFFFF"/>
        <path d="M10 14 C 10 11.5, 12 10, 16 10 C 20 10, 22 11.5, 22 14 C 22 16, 19 17, 16 17 C 13 17, 10 16, 10 14 Z" fill="url(#seoul-deck)"/>
        <path d="M11 14 C 11 12.5, 13 11.5, 16 11.5 C 19 11.5, 21 12.5, 21 14 C 21 15, 19 15.5, 16 15.5 C 13 15.5, 11 15, 11 14 Z" fill="#E1F5FE" opacity="0.6"/>
        <rect x="15.5" y="4" width="1" height="6" fill="#F44336"/>
        <circle cx="16" cy="3" r="1.5" fill="#EF5350"/>
        <rect x="14" y="6" width="4" height="1" fill="#E53935" rx="0.5"/>
      </svg>
    );
  }
  if (id === 'busan') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 부산: 광안대교 야경 (🌉 이모지 느낌) */}
        <rect x="2" y="4" width="28" height="26" rx="6" fill="url(#busan-sky)"/>
        <defs>
          <linearGradient id="busan-sky" x1="16" y1="4" x2="16" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1A237E"/><stop offset="1" stopColor="#3949AB"/>
          </linearGradient>
          <linearGradient id="busan-water" x1="16" y1="25" x2="16" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0288D1"/><stop offset="1" stopColor="#01579B"/>
          </linearGradient>
        </defs>
        <circle cx="24" cy="10" r="3" fill="#FFF59D"/>
        <path d="M10 12 L12 12 L13 24 L9 24 Z" fill="#CFD8DC"/>
        <path d="M20 12 L22 12 L23 24 L19 24 Z" fill="#CFD8DC"/>
        <path d="M2 18 Q 11 26 16 18 T 30 18" stroke="#FFFFFF" strokeWidth="1" fill="none" opacity="0.8"/>
        <rect x="2" y="22" width="28" height="2" fill="#FF5252"/>
        <path d="M2 25 L30 25 L30 28 C 30 29.1 29.1 30 28 30 L4 30 C 2.9 30 2 29.1 2 28 Z" fill="url(#busan-water)"/>
      </svg>
    );
  }
  if (id === 'jeju') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 제주: 돌하르방과 귤 (🗿 이모지 스타일) */}
        <path d="M10 12 C 10 5, 22 5, 22 12 L 24 30 L 8 30 Z" fill="url(#jeju-stone)"/>
        <defs>
          <linearGradient id="jeju-stone" x1="10" y1="5" x2="24" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#BDBDBD"/><stop offset="1" stopColor="#616161"/>
          </linearGradient>
        </defs>
        <path d="M8 12 Q 16 15 24 12" stroke="#757575" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <circle cx="13" cy="16" r="2" fill="#424242"/>
        <circle cx="19" cy="16" r="2" fill="#424242"/>
        <path d="M15 18 L17 18 L18 21 L14 21 Z" fill="#757575"/>
        <path d="M14 24 Q 16 25 18 24" stroke="#424242" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M10 26 C 12 25, 14 25, 16 27" stroke="#757575" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M22 23 C 20 22, 18 22, 16 24" stroke="#757575" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="26" cy="26" r="4.5" fill="#FFB300"/>
        <circle cx="25.5" cy="25.5" r="3.5" fill="#FFCA28"/>
        <path d="M26 21.5 Q 28 19.5 29 20.5" stroke="#4CAF50" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    );
  }
  return null;
};

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
          
{/* 🟢 탭 버튼 (2.5배 아이콘 비율 & Medium 폰트 적용) */}
<div
            className={
              isScrolled
                ? 'flex gap-6 mb-4 transition-all duration-300 opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden'
                : 'flex gap-8 mb-4 transition-all duration-300 opacity-100 translate-y-0 h-auto'
            }
          >
            {/* 🎈 체험 탭 */}
            <button
              onClick={() => setActiveTab('experience')}
              className={`group flex items-center gap-2 pl-1 pr-6 py-2 rounded-full transition-all duration-200 outline-none hover:bg-slate-50/80 ${
                activeTab === 'experience' ? 'opacity-100' : 'opacity-50 hover:opacity-100 grayscale-[30%] hover:grayscale-0'
              }`}
            >
              {/* 아이콘 영역 (54px - 텍스트 대비 약 2.5배 체감 크기) */}
              <div className="relative w-[90px] h-[90px] flex items-center justify-center shrink-0">
                {/* NEW 배지 (좌측 상단에 딱 맞게) */}
                <div className="absolute top-0 left-0 bg-[#0066CC] text-white text-[10px] font-bold px-1.5 py-[2px] rounded-full shadow-sm z-10 tracking-wide border border-white transform -translate-x-1 translate-y-1">
                  NEW
                </div>
                {/* 고화질 이미지 */}
                <img 
                  src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/e47ab655-027b-4679-b2e6-df1c99a5c33d.png?im_w=240" 
                  alt="체험" 
                  className="w-full h-full object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                />
              </div>
              
              {/* 텍스트 (17px, Medium - 부드럽고 큼직하게) */}
              <span className={`text-[17px] font-medium whitespace-nowrap tracking-tight ${
                activeTab === 'experience' ? 'text-[#222222]' : 'text-[#717171]'
              }`}>
                {t('cat_exp')}
              </span>
            </button>

            {/* 🛎️ 서비스 탭 */}
            <button
              onClick={() => setActiveTab('service')}
              className={`group flex items-center gap-2 pl-1 pr-6 py-2 rounded-full transition-all duration-200 outline-none hover:bg-slate-50/80 ${
                activeTab === 'service' ? 'opacity-100' : 'opacity-50 hover:opacity-100 grayscale-[30%] hover:grayscale-0'
              }`}
            >
              {/* 아이콘 영역 (54px) */}
              <div className="relative w-[90px] h-[90px] flex items-center justify-center shrink-0">
                {/* NEW 배지 */}
                <div className="absolute top-0 left-0 bg-[#0066CC] text-white text-[10px] font-bold px-1.5 py-[2px] rounded-full shadow-sm z-10 tracking-wide border border-white transform -translate-x-1 translate-y-1">
                  NEW
                </div>
                {/* 고화질 이미지 */}
                <img 
                  src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/3d67e9a9-520a-49ee-b439-7b3a75ea814d.png?im_w=240" 
                  alt="서비스" 
                  className="w-full h-full object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                />
              </div>
              
              {/* 텍스트 (17px, Medium) */}
              <span className={`text-[17px] font-medium whitespace-nowrap tracking-tight ${
                activeTab === 'service' ? 'text-[#222222]' : 'text-[#717171]'
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
                  {/* 🟢 서울, 부산, 제주일 때만 가짜 이모지를 렌더링하고, 나머지는 원래 이모지 유지 */}
                  <span className="text-2xl transition-transform group-hover:scale-110 flex items-center justify-center h-[32px]">
                    {['seoul', 'busan', 'jeju'].includes(cat.id) ? renderKoreanEmoji(cat.id) : cat.icon}
                  </span>
                  <span className={`text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-black' : 'text-slate-600'}`}>
                    {t(cat.label)}
                  </span>                
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}