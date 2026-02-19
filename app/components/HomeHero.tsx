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

// 🟢 [추가] 밋밋한 이모지 대신 들어갈 "고화질 커스텀 도시 아이콘" 생성기
const getCategorySvg = (id: string) => {
  const baseClass = "w-[32px] h-[32px] transition-transform duration-300 group-hover:scale-110 drop-shadow-sm";
  switch (id) {
    case 'seoul': // 🇰🇷 서울: 남산타워
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 40 Q20 20 34 40 Z" fill="#81C784"/> {/* 남산 */}
          <path d="M18 40 L19 20 L21 20 L22 40 Z" fill="#B0BEC5"/> {/* 기둥 */}
          <path d="M19.5 20 L19.5 4 L20.5 4 L20.5 20 Z" fill="#CFD8DC"/> {/* 안테나 */}
          <path d="M20 1 L19.5 4 L20.5 4 Z" fill="#F44336"/> {/* 빨간 송신탑 끝 */}
          <ellipse cx="20" cy="18" rx="6" ry="3.5" fill="#0288D1"/> {/* 파란 전망대 */}
        </svg>
      );
    case 'busan': // 🇰🇷 부산: 광안대교
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 28 Q10 24 20 28 T40 28 L40 40 L0 40 Z" fill="#4FC3F7"/> {/* 바다 */}
          <rect x="8" y="8" width="5" height="24" fill="#90A4AE" rx="1"/> {/* 주탑 1 */}
          <rect x="27" y="8" width="5" height="24" fill="#90A4AE" rx="1"/> {/* 주탑 2 */}
          <path d="M0 20 Q10 32 20 20 T40 20" stroke="#CFD8DC" strokeWidth="2.5" fill="none"/> {/* 현수 케이블 */}
          <path d="M0 25 L40 25" stroke="#607D8B" strokeWidth="2.5"/> {/* 다리 상판 */}
        </svg>
      );
    case 'jeju': // 🇰🇷 제주: 돌하르방과 감귤
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="8" width="18" height="28" rx="9" fill="#78909C"/> {/* 하르방 몸통 */}
          <circle cx="13" cy="16" r="2.5" fill="#37474F"/> {/* 눈 */}
          <circle cx="21" cy="16" r="2.5" fill="#37474F"/> {/* 눈 */}
          <rect x="11" y="22" width="12" height="4" rx="2" fill="#546E7A"/> {/* 팔 */}
          <path d="M14 29 L20 29" stroke="#546E7A" strokeWidth="2.5" strokeLinecap="round"/> {/* 입 */}
          <circle cx="32" cy="30" r="6" fill="#FFA000"/> {/* 한라봉/귤 */}
          <path d="M32 24 Q34 20 36 23" stroke="#4CAF50" strokeWidth="2.5" fill="none" strokeLinecap="round"/> {/* 잎사귀 */}
        </svg>
      );
    case 'tokyo': // 🇯🇵 도쿄: 도쿄타워
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 40 L18 10 L22 10 L26 40 Z" fill="#E53935"/>
          <path d="M19 10 L20 2 L21 10 Z" fill="#BDBDBD"/>
          <rect x="15" y="25" width="10" height="3" fill="#FFFFFF"/>
          <rect x="16.5" y="15" width="7" height="2" fill="#FFFFFF"/>
        </svg>
      );
    case 'osaka': // 🇯🇵 오사카: 오사카성
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="26" width="28" height="14" fill="#CFD8DC"/>
          <path d="M2 26 L20 12 L38 26 Z" fill="#4DB6AC"/>
          <path d="M8 14 L20 4 L32 14 Z" fill="#4DB6AC"/>
          <rect x="16" y="30" width="8" height="10" fill="#8D6E63"/>
          <path d="M20 0 L20 5" stroke="#FFCA28" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      );
    case 'fukuoka': // 🇯🇵 후쿠오카: 돈코츠 라멘
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 20 L38 20 C38 32 28 38 20 38 C12 38 2 32 2 20 Z" fill="#E53935"/>
          <path d="M2 20 L38 20" stroke="#FFCA28" strokeWidth="2"/>
          <circle cx="12" cy="17" r="4.5" fill="#8D6E63"/> {/* 차슈 */}
          <circle cx="20" cy="17" r="4.5" fill="#8D6E63"/>
          <rect x="25" y="13" width="7" height="6" fill="#FFF59D" rx="1"/> {/* 계란/어묵 */}
          <path d="M8 10 Q20 22 32 10" stroke="#FFCA28" strokeWidth="2" fill="none"/> {/* 젓가락 */}
        </svg>
      );
    case 'sapporo': // 🇯🇵 삿포로: 눈꽃
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" fill="#E1F5FE"/>
          <path d="M20 6 L20 34 M6 20 L34 20 M10 10 L30 30 M10 30 L30 10" stroke="#4FC3F7" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="20" cy="20" r="5" fill="#81D4FA"/>
        </svg>
      );
    case 'nagoya': // 🇯🇵 나고야: 초밥
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="22" width="28" height="12" rx="6" fill="#FAFAFA"/> {/* 밥 */}
          <path d="M4 24 C 4 14, 20 14, 36 24 L 34 28 C 20 20, 10 24, 6 28 Z" fill="#FF7043"/> {/* 연어/새우 */}
          <rect x="17" y="17" width="6" height="18" fill="#212121"/> {/* 김 띠 */}
        </svg>
      );
    case 'all': // 🌏 전체: 맑은 지구
    default:
      return (
        <svg viewBox="0 0 40 40" className={baseClass} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" fill="#BBDEFB"/>
          <path d="M8 12 C16 2, 28 12, 24 22 C18 32, 30 38, 16 38 C4 32, 2 18, 8 12 Z" fill="#66BB6A"/>
        </svg>
      );
  }
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
                      : 'flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group border-transparent opacity-50 hover:opacity-100 hover:border-slate-200'
                  }
                >
                  {/* 🟢 기존 이모지 대신 고해상도 SVG 벡터 아이콘 렌더링 */}
                  <div className="flex items-center justify-center h-8 w-8">
                    {getCategorySvg(cat.id)}
                  </div>
                  <span className={`text-[13px] font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-slate-900' : 'text-slate-500'}`}>
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