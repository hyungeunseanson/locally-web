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

// 🟢 [추가] 애플 이모지 스타일(2.5D, 광택, 그라데이션) 완벽 재현 렌더러
const renderKoreanEmoji = (id: string) => {
  // text-2xl 사이즈에 자연스럽게 어울리도록 28px, 고화질용 viewBox 64x64 사용
  const size = "28"; 
  const style = { 
    display: 'inline-block', 
    verticalAlign: 'middle', 
    filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.15))' // 이모지 특유의 입체 그림자
  };

  if (id === 'seoul') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 서울: 경복궁 (🏯 오사카성 이모지와 완벽한 통일감) */}
        <defs>
          <linearGradient id="roofGrad" x1="32" y1="6" x2="32" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00838F"/><stop offset="1" stopColor="#004D40"/>
          </linearGradient>
          <linearGradient id="woodGrad" x1="32" y1="20" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D32F2F"/><stop offset="1" stopColor="#880E4F"/>
          </linearGradient>
          <linearGradient id="stoneGrad" x1="32" y1="50" x2="32" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#CFD8DC"/><stop offset="1" stopColor="#78909C"/>
          </linearGradient>
        </defs>
        
        {/* 기단 (돌) */}
        <path d="M6 50 L58 50 L62 60 L2 60 Z" fill="url(#stoneGrad)"/>
        <path d="M6 50 L58 50 L58 52 L6 52 Z" fill="#FFFFFF" opacity="0.3"/> {/* 하이라이트 */}
        
        {/* 1층 기둥 & 벽 (붉은색) */}
        <rect x="12" y="34" width="40" height="16" fill="url(#woodGrad)"/>
        <rect x="26" y="38" width="12" height="12" fill="#3E2723" rx="1"/> {/* 문 */}
        
        {/* 1층 지붕 (청기와) */}
        <path d="M2 34 Q 16 26 32 30 Q 48 26 62 34 L 56 26 Q 32 18 8 26 Z" fill="url(#roofGrad)"/>
        <path d="M2 34 Q 16 26 32 30 Q 48 26 62 34" stroke="#4DD0E1" strokeWidth="1.5" fill="none"/> {/* 기와 빛 반사 */}
        
        {/* 2층 기둥 & 벽 */}
        <rect x="18" y="20" width="28" height="10" fill="url(#woodGrad)"/>
        <rect x="28" y="22" width="8" height="3" fill="#388E3C" rx="0.5"/> {/* 단청/현판 느낌 */}
        
        {/* 2층 지붕 (메인) */}
        <path d="M8 22 Q 20 12 32 16 Q 44 12 56 22 L 48 10 Q 32 4 16 10 Z" fill="url(#roofGrad)"/>
        <path d="M8 22 Q 20 12 32 16 Q 44 12 56 22" stroke="#4DD0E1" strokeWidth="2" fill="none"/> {/* 기와 빛 반사 */}
        
        {/* 용마루 (지붕 꼭대기 장식) */}
        <path d="M16 10 Q 32 4 48 10" stroke="#FFCA28" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </svg>
    );
  }
  
  if (id === 'busan') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 부산: 광안대교 야경 (🌉 2.5D 샌프란시스코/야경 이모지 스타일) */}
        <defs>
          <linearGradient id="skyGrad" x1="32" y1="4" x2="32" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1A237E"/><stop offset="1" stopColor="#6A1B9A"/>
          </linearGradient>
          <linearGradient id="seaGrad" x1="32" y1="44" x2="32" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0277BD"/><stop offset="1" stopColor="#01579B"/>
          </linearGradient>
          <linearGradient id="bridgeGrad" x1="32" y1="12" x2="32" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B0BEC5"/><stop offset="1" stopColor="#455A64"/>
          </linearGradient>
        </defs>
        
        {/* 둥근 사각형 배경 (이모지 특유의 풍경 뱃지 형태) */}
        <rect x="2" y="4" width="60" height="56" rx="12" fill="url(#skyGrad)"/>
        
        {/* 별 & 달 */}
        <circle cx="50" cy="16" r="4" fill="#FFF59D"/>
        <circle cx="14" cy="12" r="1.5" fill="#FFFFFF" opacity="0.8"/>
        <circle cx="24" cy="20" r="1" fill="#FFFFFF" opacity="0.6"/>
        
        {/* 주탑 2개 (3D 효과를 위해 밝은 면/어두운 면 구분) */}
        <path d="M18 16 L22 16 L24 44 L16 44 Z" fill="url(#bridgeGrad)"/>
        <path d="M22 16 L24 16 L26 44 L24 44 Z" fill="#37474F"/> {/* 주탑 측면 그림자 */}
        
        <path d="M42 16 L46 16 L48 44 L40 44 Z" fill="url(#bridgeGrad)"/>
        <path d="M46 16 L48 16 L50 44 L48 44 Z" fill="#37474F"/>
        
        {/* 빛나는 현수교 케이블 (글로우 효과) */}
        <path d="M2 34 Q 20 44 32 34 T 62 34" stroke="#FFCA28" strokeWidth="2.5" fill="none" opacity="0.9"/>
        <path d="M2 34 Q 20 44 32 34 T 62 34" stroke="#FFE082" strokeWidth="1" fill="none"/>
        
        {/* 바다 & 물결 반사 */}
        <path d="M2 44 L62 44 L62 48 C 62 54.6 56.6 60 50 60 L14 60 C 7.4 60 2 54.6 2 48 Z" fill="url(#seaGrad)"/>
        <rect x="20" y="48" width="24" height="2" fill="#81D4FA" rx="1" opacity="0.6"/>
        <rect x="28" y="52" width="16" height="2" fill="#81D4FA" rx="1" opacity="0.4"/>
        
        {/* 다리 상판 (두께감) */}
        <rect x="2" y="40" width="60" height="4" fill="#F44336"/>
        <rect x="2" y="40" width="60" height="1.5" fill="#FF8A80"/> {/* 상판 하이라이트 */}
      </svg>
    );
  }
  
  if (id === 'jeju') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 제주: 돌하르방 + 귤 (🗿🍊 2.5D 볼륨감 극대화) */}
        <defs>
          <radialGradient id="stoneGrad" cx="30%" cy="30%" r="70%">
            <stop stopColor="#9E9E9E"/><stop offset="1" stopColor="#424242"/>
          </radialGradient>
          <radialGradient id="tangerineGrad" cx="35%" cy="35%" r="65%">
            <stop stopColor="#FFD54F"/><stop offset="0.6" stopColor="#FF9800"/><stop offset="1" stopColor="#E65100"/>
          </radialGradient>
        </defs>
        
        {/* 돌하르방 몸통 (모아이 🗿 느낌의 질감과 볼륨) */}
        <path d="M16 20 C 16 6, 40 6, 40 20 L 44 54 L 12 54 Z" fill="url(#stoneGrad)"/>
        
        {/* 모자 챙 부분 그림자 */}
        <path d="M14 20 Q 28 26 42 20" stroke="#212121" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6"/>
        
        {/* 움푹 패인 눈 */}
        <circle cx="22" cy="28" r="4" fill="#212121"/>
        <circle cx="34" cy="28" r="4" fill="#212121"/>
        <circle cx="23" cy="27" r="1.5" fill="#FFFFFF" opacity="0.2"/> {/* 눈빛 반사 */}
        
        {/* 뭉툭한 코 & 입 */}
        <path d="M28 30 L 28 36" stroke="#616161" strokeWidth="6" strokeLinecap="round"/>
        <path d="M28 36" stroke="#212121" strokeWidth="6" strokeLinecap="round" opacity="0.5" transform="translate(0, 2)"/> {/* 코 그림자 */}
        <path d="M24 42 Q 28 44 32 42" stroke="#212121" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7"/>
        
        {/* 귤 (앞쪽에 겹치게 배치하여 3D 원근감 부여) */}
        <circle cx="46" cy="46" r="14" fill="url(#tangerineGrad)"/>
        
        {/* 귤 하이라이트 (광택) */}
        <ellipse cx="40" cy="40" rx="4" ry="2" fill="#FFFFFF" opacity="0.6" transform="rotate(-30 40 40)"/>
        
        {/* 귤 꼭지와 잎사귀 */}
        <circle cx="45" cy="34" r="1.5" fill="#33691E"/>
        <path d="M46 34 Q 52 28 56 32 Q 52 38 46 34 Z" fill="#4CAF50"/>
        <path d="M46 34 Q 52 28 56 32 Q 52 38 46 34 Z" stroke="#2E7D32" strokeWidth="1" fill="none"/>
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