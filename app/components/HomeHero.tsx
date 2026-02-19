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

// 🟢 [추가] 애플 2.5D 이모지 완벽 재현 (남대문, 샌프란시스코형 다리, 모아이형 돌하르방)
const renderKoreanEmoji = (id: string) => {
  // text-[14~17px] 크기에 맞춰 시각적으로 가장 자연스러운 28px 세팅
  const size = "28"; 
  const style = { 
    display: 'inline-block', 
    verticalAlign: 'middle', 
    filter: 'drop-shadow(0px 3px 4px rgba(0,0,0,0.2))' // 리얼 이모지 특유의 입체 그림자
  };

  if (id === 'seoul') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 서울: 숭례문/남대문 (한국 전통 성문 스타일, 2.5D 입체감) */}
        <defs>
          <linearGradient id="stoneBase" x1="32" y1="42" x2="32" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#CFD8DC"/><stop offset="1" stopColor="#78909C"/>
          </linearGradient>
          <linearGradient id="woodPillar" x1="32" y1="20" x2="32" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C62828"/><stop offset="1" stopColor="#880E4F"/>
          </linearGradient>
          <linearGradient id="roofTile" x1="32" y1="6" x2="32" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#37474F"/><stop offset="1" stopColor="#1C313A"/>
          </linearGradient>
          <linearGradient id="dancheong" x1="32" y1="34" x2="32" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2E7D32"/><stop offset="1" stopColor="#1B5E20"/>
          </linearGradient>
        </defs>
        
        {/* 돌기단 (육축) */}
        <path d="M4 42 Q 8 42, 10 60 L 54 60 Q 56 42, 60 42 Z" fill="url(#stoneBase)"/>
        <path d="M6 42 L58 42 L58 44 L6 44 Z" fill="#FFFFFF" opacity="0.4"/> {/* 기단 모서리 하이라이트 */}
        
        {/* 아치형 홍예문 */}
        <path d="M22 60 L 22 50 A 10 10 0 0 1 42 50 L 42 60 Z" fill="#111111"/>
        <path d="M22 50 A 10 10 0 0 1 42 50" stroke="#455A64" strokeWidth="2" fill="none"/> {/* 아치 입체감 */}
        
        {/* 1층 붉은 기둥 (목조건물) */}
        <rect x="14" y="28" width="36" height="14" fill="url(#woodPillar)"/>
        <rect x="18" y="32" width="6" height="10" fill="#3E2723" rx="1"/> {/* 문짝 */}
        <rect x="40" y="32" width="6" height="10" fill="#3E2723" rx="1"/>
        
        {/* 1층 단청 (녹색 처마밑 장식) */}
        <rect x="12" y="26" width="40" height="4" fill="url(#dancheong)" rx="1"/>
        <rect x="12" y="26" width="40" height="1" fill="#81C784"/> {/* 단청 하이라이트 */}
        
        {/* 1층 지붕 (우아한 처마 곡선) */}
        <path d="M 4 28 C 16 18, 48 18, 60 28 C 50 24, 14 24, 4 28 Z" fill="url(#roofTile)"/>
        <path d="M 4 28 C 16 18, 48 18, 60 28" stroke="#78909C" strokeWidth="1.5" fill="none"/> {/* 지붕 빛반사 */}
        
        {/* 2층 누각 */}
        <rect x="20" y="14" width="24" height="10" fill="url(#woodPillar)"/>
        <rect x="26" y="16" width="12" height="4" fill="#1B5E20" rx="0.5"/> {/* 현판 부위 */}
        
        {/* 2층 지붕 (팔작지붕 느낌) */}
        <path d="M 8 16 C 20 6, 44 6, 56 16 C 44 10, 20 10, 8 16 Z" fill="url(#roofTile)"/>
        <path d="M 8 16 C 20 6, 44 6, 56 16" stroke="#78909C" strokeWidth="2" fill="none"/> 
        
        {/* 용마루 (지붕 꼭대기 하얀 선) */}
        <path d="M 22 6 Q 32 8 42 6" stroke="#CFD8DC" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </svg>
    );
  }
  
  if (id === 'busan') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 부산: 광안대교 샌프란시스코 야경 스타일 (🌉 애플 이모지 완벽 오마주) */}
        <defs>
          <linearGradient id="nightSky" x1="32" y1="4" x2="32" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0D47A1"/><stop offset="1" stopColor="#4A148C"/>
          </linearGradient>
          <linearGradient id="bridgeRed" x1="32" y1="12" x2="32" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F44336"/><stop offset="1" stopColor="#B71C1C"/>
          </linearGradient>
          <linearGradient id="deepWater" x1="32" y1="46" x2="32" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#01579B"/><stop offset="1" stopColor="#000000"/>
          </linearGradient>
        </defs>
        
        {/* 둥근 풍경 뱃지 */}
        <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#nightSky)"/>
        
        {/* 별 & 달 */}
        <circle cx="48" cy="18" r="5" fill="#FFF59D"/>
        <circle cx="16" cy="14" r="1.5" fill="#FFFFFF" opacity="0.9"/>
        <circle cx="28" cy="10" r="1" fill="#FFFFFF" opacity="0.6"/>
        
        {/* 현수교 주탑 2개 (빨간색) */}
        <rect x="18" y="16" width="6" height="28" fill="url(#bridgeRed)" rx="1"/>
        <rect x="22" y="16" width="2" height="28" fill="#FFFFFF" opacity="0.2"/> {/* 기둥 하이라이트 */}
        <rect x="40" y="16" width="6" height="28" fill="url(#bridgeRed)" rx="1"/>
        <rect x="44" y="16" width="2" height="28" fill="#FFFFFF" opacity="0.2"/>
        
        {/* 현수교 꼭대기 가로보 */}
        <rect x="16" y="22" width="10" height="3" fill="#D32F2F" rx="1"/>
        <rect x="38" y="22" width="10" height="3" fill="#D32F2F" rx="1"/>
        
        {/* 케이블 (스우시 곡선) */}
        <path d="M 4 28 Q 32 50 60 28" stroke="#EF5350" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M 4 28 Q 32 50 60 28" stroke="#FFFFFF" strokeWidth="1" fill="none" opacity="0.4"/> {/* 케이블 광택 */}
        
        {/* 다리 상판 */}
        <rect x="4" y="42" width="56" height="4" fill="#C62828"/>
        <rect x="4" y="42" width="56" height="1.5" fill="#FF8A80"/> {/* 상판 빛반사 */}
        
        {/* 하단 바다 영역 */}
        <path d="M 4 46 L 60 46 L 60 46 C 60 53.7 53.7 60 46 60 L 18 60 C 10.3 60 4 53.7 4 46 Z" fill="url(#deepWater)"/>
        
        {/* 바다 물결 반사광 */}
        <rect x="22" y="50" width="20" height="1.5" fill="#4FC3F7" rx="0.5" opacity="0.8"/>
        <rect x="30" y="54" width="12" height="1.5" fill="#4FC3F7" rx="0.5" opacity="0.5"/>
      </svg>
    );
  }
  
  if (id === 'jeju') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* 🇰🇷 제주: 한라산 + 모아이 스타일 리얼 돌하르방 (🏔️ + 🗿 조합) */}
        <defs>
          <linearGradient id="daySky" x1="32" y1="4" x2="32" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4FC3F7"/><stop offset="1" stopColor="#E1F5FE"/>
          </linearGradient>
          <linearGradient id="hallasan" x1="32" y1="20" x2="32" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#66BB6A"/><stop offset="1" stopColor="#2E7D32"/>
          </linearGradient>
          <radialGradient id="moaiStone" cx="35%" cy="30%" r="70%">
            <stop stopColor="#B0BEC5"/><stop offset="0.7" stopColor="#546E7A"/><stop offset="1" stopColor="#263238"/>
          </radialGradient>
        </defs>
        
        {/* 둥근 풍경 뱃지 배경 */}
        <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#daySky)"/>
        
        {/* 구름 */}
        <path d="M 12 20 Q 16 16 20 20 Q 24 18 28 22 L 12 22 Z" fill="#FFFFFF" opacity="0.9"/>
        
        {/* 배경 한라산 (완만한 화산 지형) */}
        <path d="M 4 60 L 22 30 L 32 30 L 52 60 Z" fill="url(#hallasan)"/>
        <path d="M 22 30 L 32 30 L 34 34 L 20 34 Z" fill="#A5D6A7"/> {/* 분화구 부근 하이라이트 */}
        
        {/* 전경: 거대하고 무거운 모아이 스타일 돌하르방 (우측 배치) */}
        <path d="M 36 18 C 36 10, 56 10, 56 18 L 60 60 L 32 60 Z" fill="url(#moaiStone)"/>
        
        {/* 돌하르방 이목구비 (깊고 입체적인 그림자) */}
        <path d="M 38 28 Q 46 32 54 28" stroke="#37474F" strokeWidth="3" fill="none" strokeLinecap="round"/> {/* 무거운 눈썹뼈 */}
        <path d="M 38 29 Q 46 33 54 29" stroke="#CFD8DC" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4"/> {/* 눈썹뼈 빛반사 */}
        
        <circle cx="42" cy="34" r="3" fill="#111111"/> {/* 푹 패인 눈 */}
        <circle cx="50" cy="34" r="3" fill="#111111"/>
        
        <rect x="44" y="34" width="4" height="10" rx="2" fill="#455A64"/> {/* 뭉툭한 코 */}
        <path d="M 48 34 L 48 44" stroke="#263238" strokeWidth="1" opacity="0.6"/> {/* 코 측면 그림자 */}
        
        <path d="M 42 48 Q 46 50 50 48" stroke="#263238" strokeWidth="2.5" fill="none" strokeLinecap="round"/> {/* 굳게 다문 입 */}
        
        {/* 돌하르방 몸통/팔 디테일 */}
        <path d="M 34 54 C 40 54, 46 52, 46 52" stroke="#455A64" strokeWidth="4" fill="none" strokeLinecap="round"/> {/* 얹은 팔 */}
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