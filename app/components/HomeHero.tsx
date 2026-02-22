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

  // 🟢 [추가] 리얼 2.5D 애플 이모지 퀄리티 완벽 재현 (배경 제거, 사물 디테일 집중)
  const renderKoreanEmoji = (id: string) => {
    // text-[14~17px] 크기에 딱 맞는 28px 세팅
    const size = "28";
    const style = {
      display: 'inline-block',
      verticalAlign: 'middle',
      filter: 'drop-shadow(0px 3px 3px rgba(0,0,0,0.25))' // 리얼 이모지의 깊은 그림자
    };

    if (id === 'seoul') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
          {/* 🇰🇷 서울: 웅장한 한국 성문 (🏯 이모지 완벽 호환, 2.5D 광택) */}
          <defs>
            <linearGradient id="stoneBase" x1="32" y1="40" x2="32" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#CFD8DC" /><stop offset="1" stopColor="#546E7A" />
            </linearGradient>
            <linearGradient id="roofBlue" x1="32" y1="4" x2="32" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#455A64" /><stop offset="1" stopColor="#1C313A" />
            </linearGradient>
            <linearGradient id="woodRed" x1="32" y1="20" x2="32" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D32F2F" /><stop offset="1" stopColor="#880E4F" />
            </linearGradient>
          </defs>

          {/* 하단 돌기단 (육축) */}
          <path d="M 4 40 L 60 40 L 64 64 L 0 64 Z" fill="url(#stoneBase)" />
          <path d="M 4 40 L 60 40 L 61 43 L 3 43 Z" fill="#FFFFFF" opacity="0.35" /> {/* 기단 모서리 빛 반사 */}
          <path d="M 64 64 L 60 40 L 59 40 L 63 64 Z" fill="#FFFFFF" opacity="0.2" />

          {/* 중앙 아치 (홍예문) */}
          <path d="M 22 64 L 22 50 C 22 43, 42 43, 42 50 L 42 64 Z" fill="#111111" />
          <path d="M 20 64 L 20 50 C 20 42, 44 42, 44 50 L 44 64" stroke="#90A4AE" strokeWidth="2.5" fill="none" /> {/* 아치 입체 테두리 */}

          {/* 1층 목조 벽과 기둥 */}
          <rect x="12" y="28" width="40" height="12" fill="url(#woodRed)" />
          <rect x="28" y="28" width="8" height="12" fill="#3E2723" /> {/* 문짝 */}
          <rect x="16" y="32" width="4" height="8" fill="#3E2723" /> {/* 창살 */}
          <rect x="44" y="32" width="4" height="8" fill="#3E2723" />
          <rect x="10" y="25" width="44" height="4" fill="#2E7D32" rx="1" /> {/* 단청 (녹색) */}
          <rect x="10" y="25" width="44" height="1" fill="#A5D6A7" /> {/* 단청 빛 반사 */}

          {/* 1층 기와지붕 (처마 곡선) */}
          <path d="M 2 26 C 16 14, 48 14, 62 26 C 48 24, 16 24, 2 26 Z" fill="url(#roofBlue)" />
          <path d="M 2 26 C 16 14, 48 14, 62 26" stroke="#90A4AE" strokeWidth="1.5" fill="none" /> {/* 지붕 하이라이트 */}

          {/* 2층 누각 */}
          <rect x="20" y="14" width="24" height="10" fill="url(#woodRed)" />
          <rect x="18" y="11" width="28" height="4" fill="#2E7D32" rx="1" />
          <rect x="18" y="11" width="28" height="1" fill="#A5D6A7" />
          <rect x="28" y="14" width="8" height="4" fill="#1B5E20" rx="0.5" /> {/* 현판 */}
          <rect x="28" y="14" width="8" height="1" fill="#FFCA28" opacity="0.8" />

          {/* 2층 기와지붕 (팔작지붕 느낌) */}
          <path d="M 6 14 C 20 2, 44 2, 58 14 C 44 11, 20 11, 6 14 Z" fill="url(#roofBlue)" />
          <path d="M 6 14 C 20 2, 44 2, 58 14" stroke="#90A4AE" strokeWidth="2" fill="none" />

          {/* 용마루 (지붕 꼭대기 흰색 장식) */}
          <path d="M 20 4 Q 32 6 44 4" stroke="#CFD8DC" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      );
    }

    if (id === 'busan') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
          {/* 🇰🇷 부산: 빨간 다리 오직 다리만 (금문교/광안대교 2.5D 리얼 오브젝트) */}
          <defs>
            <linearGradient id="bridgeRed" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F44336" /><stop offset="1" stopColor="#B71C1C" />
            </linearGradient>
            <linearGradient id="cableGrad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#EF5350" /><stop offset="0.5" stopColor="#FFCDD2" /><stop offset="1" stopColor="#EF5350" />
            </linearGradient>
          </defs>

          {/* 상판 (Deck) */}
          <path d="M 0 46 L 64 46 L 64 54 L 0 54 Z" fill="url(#bridgeRed)" />
          <path d="M 0 46 L 64 46 L 64 48 L 0 48 Z" fill="#FFCDD2" opacity="0.8" /> {/* 상판 윗면 빛 반사 */}
          <path d="M 0 52 L 64 52 L 64 54 L 0 54 Z" fill="#7F0000" opacity="0.8" /> {/* 상판 그림자 */}

          {/* 좌측 주탑 (볼륨감을 위한 하이라이트와 섀도우) */}
          <path d="M 14 6 L 22 6 L 24 64 L 12 64 Z" fill="url(#bridgeRed)" />
          <path d="M 14 6 L 16 6 L 17 64 L 12 64 Z" fill="#FFCDD2" opacity="0.4" /> {/* 둥근 질감광 */}
          <path d="M 20 6 L 22 6 L 24 64 L 22 64 Z" fill="#7F0000" opacity="0.6" />
          <rect x="13.5" y="24" width="9" height="5" fill="#7F0000" />
          <rect x="14.5" y="38" width="8.5" height="5" fill="#7F0000" />

          {/* 우측 주탑 */}
          <path d="M 42 6 L 50 6 L 52 64 L 40 64 Z" fill="url(#bridgeRed)" />
          <path d="M 42 6 L 44 6 L 45 64 L 40 64 Z" fill="#FFCDD2" opacity="0.4" />
          <path d="M 48 6 L 50 6 L 52 64 L 50 64 Z" fill="#7F0000" opacity="0.6" />
          <rect x="41.5" y="24" width="9" height="5" fill="#7F0000" />
          <rect x="41" y="38" width="8.5" height="5" fill="#7F0000" />

          {/* 굵고 반짝이는 현수 케이블 (스우시 곡선) */}
          <path d="M -8 18 Q 32 46 72 18" stroke="url(#cableGrad)" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M -8 18 Q 32 46 72 18" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.6" /> {/* 케이블 광택 */}

          {/* 세로 와이어 (현수선) */}
          <line x1="6" y1="28" x2="6" y2="46" stroke="#EF5350" strokeWidth="2" />
          <line x1="32" y1="44" x2="32" y2="46" stroke="#EF5350" strokeWidth="2" />
          <line x1="58" y1="28" x2="58" y2="46" stroke="#EF5350" strokeWidth="2" />
        </svg>
      );
    }

    if (id === 'jeju') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
          {/* 🇰🇷 제주: 오직 돌하르방 (🗿 모아이 석상 느낌의 질감과 볼륨 극대화) */}
          <defs>
            <linearGradient id="dolBody" x1="16" y1="4" x2="48" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#90A4AE" /><stop offset="1" stopColor="#263238" />
            </linearGradient>
            <linearGradient id="dolRim" x1="16" y1="4" x2="48" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#CFD8DC" /><stop offset="1" stopColor="#546E7A" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 전체 몸통 (길쭉하고 볼륨감 있는 모아이 형태) */}
          <path d="M 22 16 C 22 2, 42 2, 42 16 L 48 62 C 48 64, 16 64, 16 62 Z" fill="url(#dolBody)" />

          {/* 왼쪽 가장자리 림라이트 (입체감을 위한 강한 빛 반사) */}
          <path d="M 22 16 C 22 2, 42 2, 42 16 L 48 62" stroke="url(#dolRim)" strokeWidth="2.5" fill="none" opacity="0.8" />

          {/* 모자 (벙거지 형태)와 그림자 */}
          <path d="M 18 18 C 18 6, 46 6, 46 18 C 46 22, 18 22, 18 18 Z" fill="#37474F" />
          <path d="M 18 18 C 18 12, 46 12, 46 18" fill="#546E7A" /> {/* 모자 위쪽 빛 */}

          {/* 움푹 패인 큰 눈 */}
          <ellipse cx="26" cy="28" rx="4.5" ry="4.5" fill="#111111" />
          <ellipse cx="38" cy="28" rx="4.5" ry="4.5" fill="#111111" />
          <ellipse cx="27" cy="27" rx="1.5" ry="1" fill="#FFFFFF" opacity="0.15" transform="rotate(-30 27 27)" /> {/* 미세한 눈동자 빛 */}

          {/* 뭉툭하고 넓은 코 */}
          <rect x="29" y="30" width="6" height="12" rx="3" fill="#455A64" />
          <path d="M 29 42 L 35 42 L 35 44 L 29 44 Z" fill="#111111" opacity="0.7" /> {/* 코 밑 그림자 */}

          {/* 굳게 다문 입술 */}
          <path d="M 24 48 Q 32 50 40 48" stroke="#111111" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />

          {/* 배에 얹은 두 손 (돌하르방 시그니처) */}
          <path d="M 16 54 Q 32 48 48 54" stroke="#455A64" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 16 54 Q 32 48 48 54" stroke="#78909C" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" transform="translate(0,-2)" /> {/* 손등 하이라이트 */}
        </svg>
      );
    }
    return null;
  };

  return (
    <>
      {/* 🟢 1. 상단 고정 헤더 & Sticky 캡슐 검색바 */}
      <div className={`hidden md:block fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-sm' : ''} h-20`}>
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
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveSearchField('location'); }}
        >
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">{t('anywhere')}</div>
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">{t('anytime')}</div>
          <div className="px-4 text-sm font-bold text-slate-500">{t('search')}</div>
          <button className="w-8 h-8 bg-[#FF385C] rounded-full flex items-center justify-center text-white ml-2">
            <Search size={14} strokeWidth={3} />
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
              className={`group flex items-center gap-2 pl-1 pr-6 py-2 rounded-full transition-all duration-200 outline-none hover:bg-slate-50/80 ${activeTab === 'experience' ? 'opacity-100' : 'opacity-50 hover:opacity-100 grayscale-[30%] hover:grayscale-0'
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
              <span className={`text-[17px] font-medium whitespace-nowrap tracking-tight ${activeTab === 'experience' ? 'text-[#222222]' : 'text-[#717171]'
                }`}>
                {t('cat_exp')}
              </span>
            </button>

            {/* 🛎️ 서비스 탭 */}
            <button
              onClick={() => setActiveTab('service')}
              className={`group flex items-center gap-2 pl-1 pr-6 py-2 rounded-full transition-all duration-200 outline-none hover:bg-slate-50/80 ${activeTab === 'service' ? 'opacity-100' : 'opacity-50 hover:opacity-100 grayscale-[30%] hover:grayscale-0'
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
              <span className={`text-[17px] font-medium whitespace-nowrap tracking-tight ${activeTab === 'service' ? 'text-[#222222]' : 'text-[#717171]'
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
            setSelectedLanguage={setSelectedLanguage || (() => { })}
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